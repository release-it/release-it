const fs = require('fs');
const path = require('path');
const got = require('got');
const _ = require('lodash');
const globby = require('globby');
const FormData = require('form-data');
const debug = require('debug')('release-it:gitlab');
const Release = require('./release');
const { format } = require('./util');
const { gitlab: defaults } = require('../conf/release-it.json');

const noop = Promise.resolve();

const NO_RETRIES_NEEDED = [400, 401, 404, 422];

class GitLab extends Release {
  constructor(...args) {
    super(...args);
    this.type = 'GitLab';
    this.options = _.defaults(this.options, defaults);
    this.remoteUrl = this.options.remoteUrl;
    this.assets = [];
  }

  set remoteUrl(remoteUrl) {
    super.remoteUrl = remoteUrl;
    if (this.repo) {
      this.origin = this.options.origin || `https://${this.repo.host}`;
      this.baseUrl = `${this.origin}/api/v4`;
      this.id = encodeURIComponent(this.repo.repository);
    }
  }

  get client() {
    if (this.glClient) return this.glClient;
    this.glClient = got.extend({
      baseUrl: this.baseUrl,
      method: 'POST',
      json: true,
      headers: {
        'user-agent': 'webpro/release-it',
        'Private-Token': this.token
      }
    });
    return this.glClient;
  }

  async request(endpoint, options) {
    debug(Object.assign({ url: this.baseUrl + endpoint }, options));
    const response = await this.client.post(endpoint, options);
    const body = typeof response.body === 'string' ? JSON.parse(response.body) : response.body || {};
    debug(body);
    return body;
  }

  async release({ version, changelog } = {}) {
    const { tagName, releaseName, releaseNotes, isDryRun } = this.options;
    const tag_name = format(tagName, { version });
    const name = format(releaseName, { version });
    const description = releaseNotes ? await this.changelogs.generate(releaseNotes) : changelog || '-';

    this.log.exec(`gitlab releases#createRelease "${name}" (${tag_name})`, isDryRun);

    if (isDryRun) {
      this.releaseUrl = `${this.origin}/${this.repo.repository}/releases`;
      this.isReleased = true;
      return noop;
    }

    const endpoint = `/projects/${this.id}/releases`;
    const options = {
      body: {
        name,
        tag_name,
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
        this.releaseUrl = `${this.origin}/${this.repo.repository}/releases`;
        this.isReleased = true;
        this.assets = [];
        return body;
      } catch (err) {
        debug(err);
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
    const { repository } = this.repo;
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
        debug(err);
        if (_.includes(NO_RETRIES_NEEDED, err.statusCode)) {
          return bail(err);
        }
        throw err;
      }
    });
  }

  uploadAssets() {
    const { assets, isDryRun } = this.options;

    this.log.exec('gitlab releases#uploadAssets', assets, isDryRun);

    if (!assets || isDryRun) {
      return noop;
    }

    return globby(assets).then(files => {
      if (!files.length) {
        this.log.warn(`gitlab releases#uploadAssets: assets not found (glob "${assets}" relative to ${process.cwd()})`);
      }
      return Promise.all(files.map(filePath => this.uploadAsset(filePath)));
    });
  }

  async addReleaseNotesToTag({ version, changelog } = {}) {
    // Fallback for GitLab 1.6 and lower
    const { tagName, releaseName, releaseNotes, isDryRun } = this.options;
    const tag_name = format(tagName, { version });
    const name = format(releaseName, { version });
    const description = releaseNotes ? await this.changelogs.generate(releaseNotes) : changelog;

    this.log.exec(`gitlab releases#addReleaseNotesToTag "${name}" (${tag_name})`, isDryRun);

    const endpoint = `/projects/${this.id}/repository/tags/${tag_name}/release`;
    const options = { body: { description } };

    return this.retry(async bail => {
      try {
        const body = await this.request(endpoint, options);
        this.log.verbose(`gitlab releases#addReleaseNotesToTag: done`);
        this.releaseUrl = `${this.origin}/${this.repo.repository}/tags/${tag_name}`;
        this.isReleased = true;
        return body;
      } catch (err) {
        debug(err);
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
