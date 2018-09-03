const fs = require('fs');
const path = require('path');
const GitHubApi = require('@octokit/rest');
const retry = require('async-retry');
const globby = require('globby');
const mime = require('mime-types');
const _ = require('lodash');
const { format } = require('./util');
const { warn, verbose, logExec, logDry } = require('./log');
const { config } = require('./config');
const { GithubClientError } = require('./errors');
const { debug } = require('./debug');

const noop = Promise.resolve();

const NO_RETRIES_NEEDED = [400, 401, 404, 422];

const githubClients = {};

const { github } = config.options;

const getGithubClient = ({ host, token, proxy }) => {
  if (!githubClients[host]) {
    const isGitHub = host === 'github.com';
    const baseUrl = `https://${isGitHub ? 'api.github.com' : host}${isGitHub ? '' : '/api/v3'}`;
    const options = {
      version: '3.0.0',
      baseUrl,
      timeout: github.timeout,
      headers: {
        'user-agent': 'webpro/release-it'
      }
    };

    if (proxy) {
      options.proxy = proxy;
    }

    const client = new GitHubApi(options);

    client.authenticate({
      type: 'oauth',
      token
    });

    githubClients[host] = client;
  }
  return githubClients[host];
};

const parseErrorMessage = err => {
  let msg = err;
  try {
    if (err instanceof Error) {
      const { message, code, status } = err;
      msg = `${code} ${status} (${message.replace(/[\n\r]+/g, ' ')})`;
    }
  } catch (err) {
    debug(err);
  }
  return msg;
};

const release = ({ version, tagName, repo, changelog = '', github }) => {
  logExec('octokit releases#createRelease');

  if (config.isDryRun) {
    logDry();
    return noop;
  }

  const { preRelease: prerelease, draft, token, proxy } = github;
  const { owner, project } = repo;
  const host = github.host || repo.host;
  const tag_name = format(tagName, version);
  const name = format(github.releaseName, version);
  const githubClient = getGithubClient({ host, token, proxy });

  return retry(
    async bail =>
      new Promise((resolve, reject) => {
        githubClient.repos.createRelease(
          {
            owner,
            repo: project,
            tag_name,
            name,
            body: changelog,
            prerelease,
            draft
          },
          (err, response) => {
            if (err) {
              const msg = parseErrorMessage(err);
              const { code } = err;
              if (_.includes(NO_RETRIES_NEEDED, parseInt(code, 10))) {
                bail(new GithubClientError(msg));
                return;
              }
              return reject(msg);
            } else {
              verbose(
                `octokit releases#createRelease: done (${response.headers.location} ${response.data.tag_name} "${
                  response.data.name
                }")`
              );
              resolve(response.data);
            }
          }
        );
      }),
    {
      retries: 2
    }
  );
};

const uploadAsset = ({ release, repo, github, filePath }) => {
  const { token } = github;
  const host = github.host || repo.host;
  const githubClient = getGithubClient({ host, token });

  const url = release.upload_url;
  const name = path.basename(filePath);
  const contentType = mime.contentType(name) || 'application/octet-stream';
  const contentLength = fs.statSync(filePath).size;

  return retry(
    async bail =>
      new Promise((resolve, reject) => {
        githubClient.repos.uploadAsset(
          {
            url,
            file: fs.createReadStream(filePath),
            name,
            contentType,
            contentLength
          },
          (err, response) => {
            if (err) {
              const msg = parseErrorMessage(err);
              const { code } = err;
              if (_.includes(NO_RETRIES_NEEDED, parseInt(code, 10))) {
                bail(new GithubClientError(msg));
                return;
              }
              return reject(msg);
            }
            verbose(`octokit releases#uploadAsset: done (${response.data.browser_download_url})`);
            resolve(response.data);
          }
        );
      }),
    {
      retries: 2
    }
  );
};

const uploadAssets = ({ release, repo, github }) => {
  const { assets } = github;

  if (!assets) {
    return noop;
  }

  logExec('octokit releases#uploadAsset');

  if (config.isDryRun) {
    logDry();
    return noop;
  }

  return globby(assets).then(files => {
    if (!files.length) {
      warn(`octokit releases#uploadAssets: assets not found (glob "${assets}" relative to ${process.cwd()})`);
    }
    return Promise.all(files.map(filePath => uploadAsset({ release, repo, filePath, github })));
  });
};

module.exports = {
  release,
  uploadAssets
};
