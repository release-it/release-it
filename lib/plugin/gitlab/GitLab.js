const fs = require('fs');
const path = require('path');
const got = require('got');
const globby = require('globby');
const FormData = require('form-data');
const Release = require('../GitRelease');
const { format } = require('../../util');
const prompts = require('./prompts');

const noop = Promise.resolve();

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
      prefixUrl: this.baseUrl,
      method: 'POST',
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

    if (this.options.skipChecks) return;

    if (!(await this.isAuthenticated())) {
      throw new Error(`Could not authenticate with GitLab using environment variable "${this.options.tokenRef}".`);
    }
    if (!(await this.isCollaborator())) {
      const { user, repo } = this.getContext();
      throw new Error(`User ${user.username} is not a collaborator for ${repo.repository}.`);
    }
  }

  async isAuthenticated() {
    if (this.global.isDryRun) return true;
    const endpoint = `user`;
    try {
      const { id, username } = await this.request(endpoint, { method: 'GET' });
      this.setContext({ user: { id, username } });
      return true;
    } catch (err) {
      this.debug(err);
      return false;
    }
  }

  async isCollaborator() {
    if (this.global.isDryRun) return true;
    const { id } = this.getContext('user');
    const endpoint = `projects/${this.id}/members/all/${id}`;
    try {
      const user = await this.request(endpoint, { method: 'GET' });
      return user && user.access_level >= 30;
    } catch (err) {
      this.debug(err);
      if (err.name === 'HTTPError' && err.response.statusCode === 404) {
        // Using another endpoint, since "/projects/:id/members/all/:user_id" was introduced in v12.4
        const endpoint = `projects/${this.id}/members/${id}`;
        try {
          const user = await this.request(endpoint, { method: 'GET' });
          return user && user.access_level >= 30;
        } catch (err) {
          this.debug(err);
          return false;
        }
      } else {
        return false;
      }
    }
  }

  async release() {
    const glRelease = () => this.createRelease();
    const glUploadAssets = () => this.uploadAssets();

    if (this.global.isCI) {
      await this.step({ enabled: this.options.assets, task: glUploadAssets, label: 'GitLab upload assets' });
      return await this.step({ task: glRelease, label: 'GitLab release' });
    } else {
      const release = () => glUploadAssets().then(() => glRelease());
      return await this.step({ task: release, label: 'GitLab release', prompt: 'release' });
    }
  }

  async request(endpoint, options) {
    this.debug(Object.assign({ url: `${this.baseUrl}/${endpoint}` }, options));
    const method = (options.method || 'POST').toLowerCase();
    const response = await this.client[method](endpoint, options);
    const body = typeof response.body === 'string' ? JSON.parse(response.body) : response.body || {};
    this.debug(body);
    return body;
  }

  async createRelease() {
    const { releaseName } = this.options;
    const { tagName, releaseNotes, repo } = this.getContext();
    const { isDryRun } = this.global;
    const name = format(releaseName, this.config.getContext());
    const description = releaseNotes || '-';
    const releaseUrl = `${this.origin}/${repo.repository}/-/releases`;

    this.log.exec(`gitlab releases#createRelease "${name}" (${tagName})`, { isDryRun });

    if (isDryRun) {
      this.setContext({ isReleased: true, releaseUrl });
      return true;
    }

    const endpoint = `projects/${this.id}/releases`;
    const options = {
      json: {
        name,
        tag_name: tagName,
        description
      }
    };

    if (this.assets.length) {
      options.json.assets = {
        links: this.assets
      };
    }

    try {
      await this.request(endpoint, options);
      this.log.verbose('gitlab releases#createRelease: done');
      this.setContext({ isReleased: true, releaseUrl });
      return true;
    } catch (err) {
      this.debug(err);
      throw err;
    }
  }

  async uploadAsset(filePath) {
    const name = path.basename(filePath);
    const { repository } = this.getContext('repo');
    const endpoint = `projects/${this.id}/uploads`;

    const body = new FormData();
    body.append('file', fs.createReadStream(filePath));
    const options = { body };

    try {
      const body = await this.request(endpoint, options);
      this.log.verbose(`gitlab releases#uploadAsset: done (${body.url})`);
      this.assets.push({
        name,
        url: `${this.origin}/${repository}${body.url}`
      });
    } catch (err) {
      this.debug(err);
      throw err;
    }
  }

  uploadAssets() {
    const { assets } = this.options;
    const { isDryRun } = this.global;

    this.log.exec('gitlab releases#uploadAssets', assets, { isDryRun });

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
}

module.exports = GitLab;
