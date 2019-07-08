const fs = require('fs');
const path = require('path');
const got = require('got');
const _ = require('lodash');
const globby = require('globby');
const FormData = require('form-data');
const Release = require('../GitRelease');
const { format } = require('../../util');
const prompts = require('./prompts');

const noop = Promise.resolve();

const NO_RETRIES_NEEDED = [400, 401, 404, 422];

class GitLab extends Release {
  constructor(...args) {
    super(...args);
    this.registerPrompts(prompts);
    this.type = 'GitLab';
    this.assets = [];
  }

  get client() {
    if (this._client) return this._client;
    this._client = got.extend({
      baseUrl: this.baseUrl,
      method: 'POST',
      json: true,
      headers: {
        'user-agent': 'webpro/release-it',
        'Private-Token': this.token
      }
    });
    return this._client;
  }

  async init() {
    await super.init();
    const { repo } = this.getContext();
    this.origin = this.options.origin || `https://${repo.host}`;
    this.baseUrl = `${this.origin}/api/v4`;
    this.id = encodeURIComponent(repo.repository);
  }

  async release() {
    const glRelease = () => this.createRelease();
    const glUploadAssets = () => this.uploadAssets();

    if (this.global.isCI) {
      await this.step({ enabled: this.options.assets, task: glUploadAssets, label: 'GitLab upload assets' });
      await this.step({ task: glRelease, label: 'GitLab release' });
    } else {
      const release = () => glUploadAssets().then(() => glRelease());
      await this.step({ task: release, label: 'GitLab release', prompt: 'release' });
    }
  }

  async request(endpoint, options) {
    this.debug(Object.assign({ url: this.baseUrl + endpoint }, options));
    const response = await this.client.post(endpoint, options);
    const body = typeof response.body === 'string' ? JSON.parse(response.body) : response.body || {};
    this.debug(body);
    return body;
  }

  async createRelease({ changelog } = {}) {
    const { releaseName } = this.options;
    const { version, tagName, releaseNotes } = this.getContext();
    const { repo } = this.getContext();
    const { isDryRun } = this.global;
    const name = format(releaseName, { version });
    const description = releaseNotes || '-';

    this.log.exec(`gitlab releases#createRelease "${name}" (${tagName})`, isDryRun);

    if (isDryRun) {
      this.releaseUrl = `${this.origin}/${repo.repository}/releases`;
      this.isReleased = true;
      return noop;
    }

    const endpoint = `/projects/${this.id}/releases`;
    const options = {
      body: {
        name,
        tag_name: tagName,
        description
      }
    };

    if (this.assets.length) {
      options.body.assets = {
        links: this.assets
      };
    }

    return this.retry(async bail => {
      try {
        const body = await this.request(endpoint, options);
        this.log.verbose(`gitlab releases#createRelease: done`);
        this.releaseUrl = `${this.origin}/${repo.repository}/releases`;
        this.isReleased = true;
        return body;
      } catch (err) {
        this.debug(err);
        if (_.includes(NO_RETRIES_NEEDED, err.statusCode)) {
          return bail(err);
        }
        throw err;
      }
    }).catch(err => {
      if (err.statusCode === 404) {
        return this.addReleaseNotesToTag({ version, changelog });
      } else {
        throw err;
      }
    });
  }

  uploadAsset(filePath) {
    const name = path.basename(filePath);
    const { repository } = this.getContext('repo');
    const endpoint = `/projects/${this.id}/uploads`;

    const body = new FormData();
    body.append('file', fs.createReadStream(filePath));
    const options = { json: false, body };

    return this.retry(async bail => {
      try {
        const body = await this.request(endpoint, options);
        this.log.verbose(`gitlab releases#uploadAsset: done (${body.url})`);
        this.assets.push({
          name,
          url: `${this.origin}/${repository}${body.url}`
        });
      } catch (err) {
        this.debug(err);
        if (_.includes(NO_RETRIES_NEEDED, err.statusCode)) {
          return bail(err);
        }
        throw err;
      }
    });
  }

  uploadAssets() {
    const { assets } = this.options;
    const { isDryRun } = this.global;

    this.log.exec('gitlab releases#uploadAssets', assets, isDryRun);

    if (!assets || isDryRun) {
      return noop;
    }

    return globby(assets).then(files => {
      if (!files.length) {
        this.log.warn(`gitlab releases#uploadAssets: could not find "${assets}" relative to ${process.cwd()}`);
      }
      return Promise.all(files.map(filePath => this.uploadAsset(filePath)));
    });
  }

  async addReleaseNotesToTag({ version, changelog } = {}) {
    // Fallback for GitLab 1.6 and lower
    const { tagName } = this.getContext();
    const { repo } = this.getContext();
    const { releaseName } = this.options;
    const name = format(releaseName, { version });
    const description = this.getContext('releaseNotes');

    this.log.exec(`gitlab releases#addReleaseNotesToTag "${name}" (${tagName})`);

    const endpoint = `/projects/${this.id}/repository/tags/${tagName}/release`;
    const options = { body: { description } };

    return this.retry(async bail => {
      try {
        const body = await this.request(endpoint, options);
        this.log.verbose(`gitlab releases#addReleaseNotesToTag: done`);
        this.releaseUrl = `${this.origin}/${repo.repository}/tags/${tagName}`;
        this.isReleased = true;
        return body;
      } catch (err) {
        this.debug(err);
        if (err.statusCode === 404) {
          this.addReleaseNotesToTag({ version, changelog });
        }
        if (_.includes(NO_RETRIES_NEEDED, err.statusCode)) {
          return bail(err);
        }
        throw err;
      }
    });
  }
}

module.exports = GitLab;
