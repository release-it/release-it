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
      this.api = `${this.origin}/api/v4`;
      this.id = encodeURIComponent(this.repo.repository);
    }
  }

  async release({ version, changelog } = {}) {
    const { tagName, releaseName, releaseNotes } = this.options;
    const tag_name = format(tagName, { version });
    const name = format(releaseName, { version });
    const description = releaseNotes ? await this.changelogs.generate(releaseNotes) : changelog || '-';

    this.log.exec(`gitlab releases#createRelease "${name}" (${tag_name})`);

    if (this.options.isDryRun) {
      this.releaseUrl = `${this.origin}/${this.repo.repository}/releases`;
      this.isReleased = true;
      return noop;
    }

    const url = `${this.api}/projects/${this.id}/releases`;
    const options = {
      method: 'POST',
      json: true,
      body: {
        name,
        tag_name,
        description
      },
      headers: {
        'user-agent': 'webpro/release-it',
        'Private-Token': this.token
      }
    };

    if (this.assets.length) {
      options.body.assets = {
        links: this.assets
      };
    }

    return this.retry(async bail => {
      try {
        debug(Object.assign({ url }, options));
        const response = await got(url, options);
        debug(response.body);
        this.log.verbose(`gitlab releases#createRelease: done`);
        this.releaseUrl = `${this.origin}/${this.repo.repository}/releases`;
        this.isReleased = true;
        this.assets = [];
        return response.body;
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
    const url = `${this.api}/projects/${this.id}/uploads`;

    const body = new FormData();
    body.append('file', fs.createReadStream(filePath));

    const options = {
      method: 'POST',
      body,
      headers: {
        'user-agent': 'webpro/release-it',
        'Private-Token': this.token
      }
    };

    return this.retry(async bail => {
      try {
        debug(Object.assign({ url }, options));
        const response = await got(url, options);
        const body = typeof response.body === 'string' ? JSON.parse(response.body) : response.body || {};
        debug(body);
        this.log.verbose(`gitlab releases#uploadAsset: done (${body.url})`);
        const asset = {
          name,
          url: `${this.origin}/${repository}${body.url}`
        };
        this.assets.push(asset);
        return asset;
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
    const { assets } = this.options;

    this.log.exec('gitlab releases#uploadAssets', assets);

    if (!assets || this.options.isDryRun) {
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
    const { tagName, releaseName, releaseNotes } = this.options;
    const tag_name = format(tagName, { version });
    const name = format(releaseName, { version });
    const description = releaseNotes ? await this.changelogs.generate(releaseNotes) : changelog;

    this.log.exec(`gitlab releases#addReleaseNotesToTag "${name}" (${tag_name})`);

    const url = `${this.api}/projects/${this.id}/repository/tags/${tag_name}/release`;
    const body = {
      description
    };
    const options = {
      method: 'POST',
      json: true,
      body
    };

    return this.retry(async bail => {
      try {
        debug(Object.assign({ url }, options));
        const response = await got(url, options);
        debug(response.body);
        this.log.verbose(`gitlab releases#addReleaseNotesToTag: done`);
        this.releaseUrl = `${this.origin}/${this.repo.repository}/tags/${tag_name}`;
        this.isReleased = true;
        return response.body;
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
