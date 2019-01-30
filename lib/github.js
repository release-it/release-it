const fs = require('fs');
const path = require('path');
const GitHubApi = require('@octokit/rest');
const globby = require('globby');
const mime = require('mime-types');
const _ = require('lodash');
const debug = require('debug')('release-it:github');
const pkg = require('../package.json');
const Release = require('./release');
const { format } = require('./util');
const { GitHubClientError } = require('./errors');
const { github: defaults } = require('../conf/release-it.json');

const noop = Promise.resolve();

const NO_RETRIES_NEEDED = [400, 401, 404, 422];

const parseErrorMessage = err => {
  let msg = err;
  if (err instanceof Error) {
    const { status, message, headers } = err;
    msg = `${_.get(headers, 'status', status)} (${message})`;
  }
  return msg;
};

class GitHub extends Release {
  constructor(...args) {
    super(...args);
    this.type = 'GitHub';
    this.options = _.defaults(this.options, defaults);
  }

  handleError(err, bail) {
    const msg = parseErrorMessage(err);
    const ghError = new GitHubClientError(msg);
    this.log.verbose(err.errors);
    debug(err);
    if (_.includes(NO_RETRIES_NEEDED, err.status)) {
      return bail(ghError);
    }
    throw ghError;
  }

  get client() {
    if (this.ghClient) return this.ghClient;
    const { proxy, timeout } = this.options;
    const host = this.options.host || this.repo.host;
    const isGitHub = host === 'github.com';
    const baseUrl = `https://${isGitHub ? 'api.github.com' : host}${isGitHub ? '' : '/api/v3'}`;
    const options = {
      baseUrl,
      auth: `token ${this.token}`,
      userAgent: `release-it/${pkg.version}`,
      request: {
        timeout
      }
    };

    if (proxy) {
      options.proxy = proxy;
    }

    const ghClient = new GitHubApi(options);

    this.ghClient = ghClient;
    return ghClient;
  }

  async release({ version, isPreRelease, changelog } = {}) {
    const { tagName, releaseName, releaseNotes, isDryRun } = this.options;
    const tag_name = format(tagName, { version });
    const name = format(releaseName, { version });
    const body = releaseNotes ? await this.changelogs.generate(releaseNotes) : changelog;

    this.log.exec(`octokit releases#createRelease "${name}" (${tag_name})`, isDryRun);

    if (isDryRun) {
      this.releaseUrl = this.getReleaseUrlFallback(version);
      this.isReleased = true;
      return noop;
    }

    const { draft } = this.options;
    const { owner, project: repo } = this.repo;

    return this.retry(async bail => {
      try {
        const options = {
          owner,
          repo,
          tag_name,
          name,
          body,
          prerelease: isPreRelease,
          draft
        };
        debug(options);
        const response = await this.client.repos.createRelease(options);
        debug(response.data);
        const { html_url, upload_url } = response.data;
        this.log.verbose(`octokit releases#createRelease: done (${response.headers.location})`);
        this.releaseUrl = html_url;
        this.uploadUrl = upload_url;
        this.isReleased = true;
        return response.data;
      } catch (err) {
        return this.handleError(err, bail);
      }
    });
  }

  uploadAsset(filePath) {
    const url = this.uploadUrl;
    const name = path.basename(filePath);
    const contentType = mime.contentType(name) || 'application/octet-stream';
    const contentLength = fs.statSync(filePath).size;

    return this.retry(async bail => {
      try {
        const options = {
          url,
          file: fs.createReadStream(filePath),
          name,
          headers: {
            'content-type': contentType,
            'content-length': contentLength
          }
        };
        debug(options);
        const response = await this.client.repos.uploadReleaseAsset(options);
        debug(response.data);
        this.log.verbose(`octokit releases#uploadAsset: done (${response.data.browser_download_url})`);
        return response.data;
      } catch (err) {
        return this.handleError(err, bail);
      }
    });
  }

  uploadAssets() {
    const { assets, isDryRun } = this.options;

    this.log.exec('octokit releases#uploadAssets', assets, isDryRun);

    if (!assets || !this.isReleased || isDryRun) {
      return noop;
    }

    return globby(assets).then(files => {
      if (!files.length) {
        this.log.warn(
          `octokit releases#uploadAssets: assets not found (glob "${assets}" relative to ${process.cwd()})`
        );
      }
      return Promise.all(files.map(filePath => this.uploadAsset(filePath)));
    });
  }

  getReleaseUrlFallback(version) {
    const tag = format(this.options.tagName, { version });
    const { host, repository } = this.repo;
    return `https://${host}/${repository}/releases/tag/${tag}`;
  }
}

module.exports = GitHub;
