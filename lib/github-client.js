const path = require('path');
const GitHubApi = require('github');
const retry = require('async-retry');
const globby = require('globby');
const _ = require('lodash');
const { debugGithubClient, debugGithubApi } = require('./debug');
const { format } = require('./util');
const log = require('./log');
const { config } = require('./config');

const noop = Promise.resolve();

const githubClients = {};

const getGithubClient = ({ host, token }) => {
  if (!githubClients[host]) {
    const client = new GitHubApi({
      version: '3.0.0',
      debug: debugGithubApi.enabled,
      protocol: 'https',
      host: host === 'github.com' ? '' : host,
      pathPrefix: host === 'github.com' ? '' : '/api/v3',
      timeout: 10000,
      headers: {
        'user-agent': 'webpro/release-it'
      }
    });

    client.authenticate({
      type: 'oauth',
      token
    });

    githubClients[host] = client;
  }
  return githubClients[host];
};

const parseErrorMessage = err => {
  const { code, status } = err;
  let msg = err;
  try {
    const errorObj = JSON.parse(err.message);
    const { message, errors } = errorObj;
    const codes = _.map(errors, 'code');
    msg = `${code} ${status}: ${message.replace(/[\n\r]+/g, ' ')} (${codes.join(', ')})`;
  } catch (err) {
    debugGithubClient(err);
  }
  return msg;
};

const NO_RETRIES_NEEDED = [401, 404, 422];

const release = ({ version, tagName, repo, changelog = '', github }) => {
  log.exec('node-github releases#createRelease');

  if (config.isDryRun) {
    log.dryRunMessage();
    return noop;
  }

  const { preRelease: prerelease, draft, token } = github;
  const { owner, project } = repo;
  const host = github.host || repo.host;
  const tag_name = format(tagName, version);
  const name = format(github.releaseName, version);
  const githubClient = getGithubClient({ host, token });

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
              // TODO: node-github logs the same in debug mode:
              // debugGithubClient('%O', err);
              if (_.includes(NO_RETRIES_NEEDED, code)) {
                bail(new Error(msg));
                return;
              }
              return reject(msg);
            } else {
              log.verbose(
                `node-github releases#createRelease: done (${response.meta.location} ${response.data.tag_name} "${
                  response.data.name
                }")`
              );
              debugGithubClient(response);
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

const uploadAsset = ({ releaseId, repo, github, filePath }) => {
  const name = path.basename(filePath);
  const { owner, project } = repo;
  const { token } = github;
  const host = github.host || repo.host;    
  const githubClient = getGithubClient({ host, token });

  return retry(
    async bail =>
      new Promise((resolve, reject) => {
        githubClient.repos.uploadAsset(
          {
            owner,
            repo: project,
            id: releaseId,
            filePath,
            name
          },
          (err, response) => {
            if (err) {
              const msg = parseErrorMessage(err);
              const { code } = err;
              // TODO: node-github logs the same in debug mode:
              // debugGithubClient('%O', err);
              if (_.includes(NO_RETRIES_NEEDED, code)) {
                bail(new Error(msg));
                return;
              }
              return reject(err);
            }
            log.verbose(`node-github releases#uploadAsset: done (${response.data.browser_download_url})`);
            debugGithubClient(response);
            resolve(response.data);
          }
        );
      }),
    {
      retries: 2
    }
  );
};

const uploadAssets = ({ releaseId, repo, github }) => {
  const { assets } = github;

  if (!assets) {
    return noop;
  }

  log.exec('node-github releases#uploadAsset');

  if (config.isDryRun) {
    log.dryRunMessage();
    return noop;
  }

  return globby(assets).then(files => {
    if (!files.length) {
      log.warn(`node-github releases#uploadAssets: assets not found (glob "${assets}" relative to ${process.cwd()})`);
    }
    return Promise.all(files.map(filePath => uploadAsset({ releaseId, repo, filePath, github })));
  });
};

module.exports = {
  release,
  uploadAssets
};
