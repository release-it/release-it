const fs = require('fs');
const path = require('path');
const { Octokit } = require('@octokit/rest');
const globby = require('globby');
const mime = require('mime-types');
const _ = require('lodash');
const pkg = require('../../../package.json');
const { format, parseVersion } = require('../../util');
const Release = require('../GitRelease');
const { GitHubClientError } = require('../../errors');
const prompts = require('./prompts');

const RETRY_CODES = [408, 413, 429, 500, 502, 503, 504, 521, 522, 524];

const parseErrormsg = err => {
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

  async init() {
    const { skipChecks, tokenRef, isUpdate } = this.options;

    await super.init();

    if (!skipChecks) {
      // If we're running on GitHub Actions, we can skip the authentication and
      // collaborator checks. Ref: https://bit.ly/2vsyRzu
      if (process.env.GITHUB_ACTIONS) {
        this.setContext({ username: process.env.GITHUB_ACTOR });
      } else {
        if (!(await this.isAuthenticated())) {
          throw new GitHubClientError(`Could not authenticate with GitHub using environment variable "${tokenRef}".`);
        }

        if (!(await this.isCollaborator())) {
          const { repository } = this.getContext('repo');
          const { username } = this.getContext();
          throw new GitHubClientError(`User ${username} is not a collaborator for ${repository}.`);
        }
      }
    }

    if (isUpdate) {
      try {
        const { id, upload_url } = await this.getLatestRelease();
        this.setContext({ isUpdate: true, isReleased: true, releaseId: id, upload_url });
      } catch (error) {
        const { latestTagName } = this.getContext();
        this.log.warn(`GitHub release for tag ${latestTagName} was not found. Creating new release.`);
        this.setContext({ isUpdate: false });
      }
    }
  }

  async isAuthenticated() {
    if (this.global.isDryRun) return true;
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
    if (this.global.isDryRun) return true;
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
    const { isUpdate } = this.getContext();
    const { isCI } = this.global;

    const type = isUpdate ? 'update' : 'create';
    const publishMethod = `${type}Release`;

    if (isCI) {
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
    const githubError = new GitHubClientError(message);
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
      log: this.global.isDebug ? console : null,
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
    const { latestTagName } = this.getContext();
    try {
      const options = {
        owner,
        repo
      };
      this.debug(options);
      const response = await this.client.repos.listReleases(options);
      const release = response.data.find(release => {
        return release.tag_name === latestTagName;
      });
      this.debug(release);
      return release;
    } catch (err) {
      return this.handleError(err, () => {});
    }
  }

  getOctokitReleaseOptions(options = {}) {
    const { owner, project: repo } = this.getContext('repo');
    const { draft = false, releaseName } = this.options;
    const { version, tagName, releaseNotes } = this.getContext();
    const { isPreRelease } = parseVersion(version);
    const name = format(releaseName, this.config.getContext());
    const body = releaseNotes;

    return Object.assign(options, {
      owner,
      repo,
      tag_name: tagName,
      name,
      body,
      draft,
      prerelease: isPreRelease
    });
  }

  async createRelease() {
    const options = this.getOctokitReleaseOptions();
    const { isDryRun } = this.global;

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
    const { isDryRun } = this.global;

    this.log.exec('octokit repos.uploadReleaseAssets', assets, { isDryRun });

    if (!assets || !isReleased || isDryRun) {
      return true;
    }

    return globby(assets).then(files => {
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

  updateRelease() {
    const { isDryRun } = this.global;
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
