const fs = require('fs');
const path = require('path');
const GitHubApi = require('@octokit/rest');
const globby = require('globby');
const mime = require('mime-types');
const _ = require('lodash');
const pkg = require('../../../package.json');
const { format, parseVersion } = require('../../util');
const Release = require('../GitRelease');
const prompts = require('./prompts');
const { GitHubClientError } = require('../../errors');

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
    this.registerPrompts(prompts);
    this.type = 'GitHub';
  }

  async release() {
    const { assets } = this.options;
    const { isInteractive } = this.global;
    const ghRelease = () => this.createRelease();
    const ghUploadAssets = () => this.uploadAssets();

    if (isInteractive) {
      const release = () => ghRelease().then(() => ghUploadAssets());
      await this.step({ task: release, label: 'GitHub release', prompt: 'release' });
    } else {
      await this.step({ task: ghRelease, label: 'GitHub release' });
      await this.step({ enabled: assets, task: ghUploadAssets, label: 'GitHub upload assets' });
    }
  }

  handleError(err, bail) {
    const msg = parseErrorMessage(err);
    const ghError = new GitHubClientError(msg);
    this.log.verbose(err.errors);
    this.debug(err);
    if (_.includes(NO_RETRIES_NEEDED, err.status)) {
      return bail(ghError);
    }
    throw ghError;
  }

  get client() {
    if (this._client) return this._client;
    const { proxy, timeout } = this.options;
    const host = this.options.host || this.getContext('repo.host');
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

    const client = new GitHubApi(options);

    this._client = client;
    return client;
  }

  async createRelease() {
    const { releaseName } = this.options;
    const { version, tagName, releaseNotes } = this.getContext();
    const { isPreRelease } = parseVersion(version);
    const { isDryRun } = this.global;
    const name = format(releaseName, { version });
    const body = releaseNotes;

    this.log.exec(`octokit releases#createRelease "${name}" (${tagName})`, isDryRun);

    if (isDryRun) {
      this.releaseUrl = this.getReleaseUrlFallback(tagName);
      this.isReleased = true;
      return noop;
    }

    const { draft } = this.options;
    const { owner, project: repo } = this.getContext('repo');

    return this.retry(async bail => {
      try {
        const options = {
          owner,
          repo,
          tag_name: tagName,
          name,
          body,
          prerelease: isPreRelease,
          draft
        };
        this.debug(options);
        const response = await this.client.repos.createRelease(options);
        this.debug(response.data);
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
        this.debug(options);
        const response = await this.client.repos.uploadReleaseAsset(options);
        this.debug(response.data);
        this.log.verbose(`octokit releases#uploadAsset: done (${response.data.browser_download_url})`);
        return response.data;
      } catch (err) {
        return this.handleError(err, bail);
      }
    });
  }

  uploadAssets() {
    const { assets } = this.options;
    const { isDryRun } = this.global;

    this.log.exec('octokit releases#uploadAssets', assets, isDryRun);

    if (!assets || !this.isReleased || isDryRun) {
      return noop;
    }

    return globby(assets).then(files => {
      if (!files.length) {
        this.log.warn(`octokit releases#uploadAssets: did not find "${assets}" relative to ${process.cwd()}`);
      }
      return Promise.all(files.map(filePath => this.uploadAsset(filePath)));
    });
  }

  getReleaseUrlFallback(tagName) {
    const { host, repository } = this.getContext('repo');
    return `https://${host}/${repository}/releases/tag/${tagName}`;
  }
}

module.exports = GitHub;
