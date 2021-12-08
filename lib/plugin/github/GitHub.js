const fs = require('fs');
const path = require('path');
const { Octokit } = require('@octokit/rest');
const globby = require('globby');
const mime = require('mime-types');
const _ = require('lodash');
const retry = require('async-retry');
const newGithubReleaseUrl = require('new-github-release-url');
const open = require('open');
const pkg = require('../../../package.json');
const { format, parseVersion, e } = require('../../util');
const Release = require('../GitRelease');
const prompts = require('./prompts');

const docs = 'https://git.io/release-it-github';

const RETRY_CODES = [408, 413, 429, 500, 502, 503, 504, 521, 522, 524];

const DEFAULT_RETRY_MIN_TIMEOUT = 1000;

const parseErrormsg = err => {
  let msg = err;
  if (err instanceof Error) {
    const { status, message } = err;
    const headers = err.response ? err.response.headers : {};
    msg = `${_.get(headers, 'status', status)} (${message})`;
  }
  return msg;
};

class GitHub extends Release {
  constructor(...args) {
    super(...args);
    this.registerPrompts(prompts);
  }

  async init() {
    await super.init();

    const { skipChecks, tokenRef, web, update } = this.options;

    if (!this.token || web) {
      if (!web) {
        this.log.warn(`Environment variable "${tokenRef}" is required for automated GitHub Releases.`);
        this.log.warn('Falling back to web-based GitHub Release.');
      }
      this.setContext({ isWeb: true });
      return;
    }

    if (!skipChecks) {
      // If we're running on GitHub Actions, we can skip the authentication and
      // collaborator checks. Ref: https://bit.ly/2vsyRzu
      if (process.env.GITHUB_ACTIONS) {
        this.setContext({ username: process.env.GITHUB_ACTOR });
      } else {
        if (!(await this.isAuthenticated())) {
          throw e(`Could not authenticate with GitHub using environment variable "${tokenRef}".`, docs);
        }

        if (!(await this.isCollaborator())) {
          const { repository } = this.getContext('repo');
          const { username } = this.getContext();
          throw e(`User ${username} is not a collaborator for ${repository}.`, docs);
        }
      }
    }

    if (update) {
      const { latestTag } = this.config.getContext();
      try {
        const { id, upload_url, tag_name } = await this.getLatestRelease();
        if (latestTag === tag_name) {
          this.setContext({ isUpdate: true, isReleased: true, releaseId: id, upload_url });
        } else {
          this.setContext({ isUpdate: false });
        }
      } catch (error) {
        this.setContext({ isUpdate: false });
      }
      if (!this.getContext('isUpdate')) {
        this.log.warn(`GitHub release for tag ${latestTag} was not found. Creating new release.`);
      }
    }
  }

  async isAuthenticated() {
    if (this.config.isDryRun) return true;
    try {
      this.log.verbose('octokit users#getAuthenticated');
      const { data } = await this.client.users.getAuthenticated();
      this.setContext({ username: data.login });
      return true;
    } catch (error) {
      this.debug(error);
      return false;
    }
  }

  async isCollaborator() {
    if (this.config.isDryRun) return true;
    const { owner, project: repo } = this.getContext('repo');
    const { username } = this.getContext();
    try {
      const options = { owner, repo, username };
      this.log.verbose(`octokit repos#checkCollaborator (${username})`);
      await this.client.repos.checkCollaborator(options);
      return true;
    } catch (error) {
      this.debug(error);
      return false;
    }
  }

  async release() {
    const { assets } = this.options;
    const { isWeb, isUpdate } = this.getContext();
    const { isCI } = this.config;

    const type = isUpdate ? 'update' : 'create';
    const publishMethod = `${type}Release`;

    if (isWeb) {
      const task = () => this.createWebRelease();
      return this.step({ task, label: 'Generating link to GitHub Release web interface', prompt: 'release' });
    } else if (isCI) {
      await this.step({ task: () => this[publishMethod](), label: `GitHub ${type} release` });
      return this.step({ enabled: assets, task: () => this.uploadAssets(), label: 'GitHub upload assets' });
    } else {
      const release = async () => {
        await this[publishMethod]();
        return this.uploadAssets();
      };
      return this.step({ task: release, label: `GitHub ${type} release`, prompt: 'release' });
    }
  }

  handleError(err, bail) {
    const message = parseErrormsg(err);
    const githubError = new Error(message);
    this.log.verbose(err.errors);
    this.debug(err);
    if (!_.includes(RETRY_CODES, err.status)) {
      return bail(githubError);
    }
    throw githubError;
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
      log: this.config.isDebug ? console : null,
      request: {
        timeout
      }
    };

    if (proxy) {
      options.proxy = proxy;
    }

    const client = new Octokit(options);

    this._client = client;
    return client;
  }

  async getLatestRelease() {
    const { owner, project: repo } = this.getContext('repo');
    try {
      const options = { owner, repo };
      this.debug(options);
      const response = await this.client.repos.listReleases({ owner, repo, per_page: 1, page: 1 });
      this.debug(response.data[0]);
      return response.data[0];
    } catch (err) {
      return this.handleError(err, () => {});
    }
  }

  getOctokitReleaseOptions(options = {}) {
    const { owner, project: repo } = this.getContext('repo');
    const { releaseName, draft = false, preRelease = false, autoGenerate } = this.options;
    const { tagName } = this.config.getContext();
    const { version, releaseNotes } = this.getContext();
    const { isPreRelease } = parseVersion(version);
    const name = format(releaseName, this.config.getContext());
    const body = autoGenerate ? null : releaseNotes;

    return Object.assign(options, {
      owner,
      repo,
      tag_name: tagName,
      name,
      body,
      draft,
      prerelease: isPreRelease || preRelease,
      generate_release_notes: autoGenerate
    });
  }

  retry(fn) {
    const { retryMinTimeout } = this.options;
    return retry(fn, {
      retries: 2,
      minTimeout: typeof retryMinTimeout === 'number' ? retryMinTimeout : DEFAULT_RETRY_MIN_TIMEOUT
    });
  }

  async createRelease() {
    const options = this.getOctokitReleaseOptions();
    const { isDryRun } = this.config;

    this.log.exec(`octokit repos.createRelease "${options.name}" (${options.tag_name})`, { isDryRun });

    if (isDryRun) {
      this.setContext({ isReleased: true, releaseUrl: this.getReleaseUrlFallback(options.tag_name) });
      return true;
    }

    return this.retry(async bail => {
      try {
        this.debug(options);
        const response = await this.client.repos.createRelease(options);
        this.debug(response.data);
        const { html_url, upload_url, id } = response.data;
        this.setContext({ isReleased: true, releaseId: id, releaseUrl: html_url, upload_url });
        this.log.verbose(`octokit repos.createRelease: done (${response.headers.location})`);
        return response.data;
      } catch (err) {
        return this.handleError(err, bail);
      }
    });
  }

  uploadAsset(filePath) {
    const url = this.getContext('upload_url');
    const name = path.basename(filePath);
    const contentType = mime.contentType(name) || 'application/octet-stream';
    const contentLength = fs.statSync(filePath).size;

    return this.retry(async bail => {
      try {
        const options = {
          url,
          data: fs.createReadStream(filePath),
          name,
          headers: {
            'content-type': contentType,
            'content-length': contentLength
          }
        };
        this.debug(options);
        const response = await this.client.repos.uploadReleaseAsset(options);
        this.debug(response.data);
        this.log.verbose(`octokit repos.uploadReleaseAsset: done (${response.data.browser_download_url})`);
        return response.data;
      } catch (err) {
        return this.handleError(err, bail);
      }
    });
  }

  uploadAssets() {
    const { assets } = this.options;
    const { isReleased } = this.getContext();
    const context = this.config.getContext();
    const { isDryRun } = this.config;

    this.log.exec('octokit repos.uploadReleaseAssets', assets, { isDryRun });

    if (!assets || !isReleased || isDryRun) {
      return true;
    }

    const patterns = _.castArray(assets).map(pattern => format(pattern, context));

    return globby(patterns).then(files => {
      if (!files.length) {
        this.log.warn(`octokit repos.uploadReleaseAssets: did not find "${assets}" relative to ${process.cwd()}`);
      }
      return Promise.all(files.map(filePath => this.uploadAsset(filePath)));
    });
  }

  getReleaseUrlFallback(tagName) {
    const { host, repository } = this.getContext('repo');
    return `https://${host}/${repository}/releases/tag/${tagName}`;
  }

  generateWebUrl() {
    const host = this.options.host || this.getContext('repo.host');
    const isGitHub = host === 'github.com';

    const options = this.getOctokitReleaseOptions();
    const url = newGithubReleaseUrl({
      user: options.owner,
      repo: options.repo,
      tag: options.tag_name,
      isPrerelease: options.prerelease,
      title: options.name,
      body: options.body
    });
    return isGitHub ? url : url.replace('github.com', host);
  }

  async createWebRelease() {
    const { isCI } = this.config;
    const { tagName } = this.config.getContext();
    const url = this.generateWebUrl();
    if (isCI) {
      this.setContext({ isReleased: true, releaseUrl: url });
    } else {
      await open(url);
      this.setContext({ isReleased: true, releaseUrl: this.getReleaseUrlFallback(tagName) });
    }
  }

  updateRelease() {
    const { isDryRun } = this.config;
    const release_id = this.getContext('releaseId');
    const options = this.getOctokitReleaseOptions({ release_id });

    this.log.exec(`octokit repos.updateRelease (${options.tag_name})`, { isDryRun });

    if (isDryRun) return true;

    return this.retry(async bail => {
      try {
        this.debug(options);
        const response = await this.client.repos.updateRelease(options);
        this.setContext({ releaseUrl: response.data.html_url });
        this.debug(response.data);
        this.log.verbose(`octokit repos.updateRelease: done (${response.headers.location})`);
        return true;
      } catch (err) {
        return this.handleError(err, bail);
      }
    });
  }
}

module.exports = GitHub;
