const _ = require('lodash');
const repoPathParse = require('parse-repo');
const Log = require('./log');
const Changelog = require('./changelog');
const { TokenError } = require('./errors');

class Release {
  constructor(...args) {
    const options = Object.assign({}, ...args);
    this.options = options;
    this.repo = repoPathParse(options.remoteUrl);
    this.log = options.log || new Log();
    this.changelogs = options.changelogs || new Changelog();
  }

  validate() {
    if (!this.options.release) return;
    if (!this.token) {
      throw new TokenError(this.type, this.options.tokenRef);
    }
  }

  get token() {
    const { tokenRef } = this.options;
    return _.get(process.env, tokenRef, null);
  }

  async getNotes() {
    const { releaseNotes } = this.options;
    return releaseNotes ? await this.changelogs.create(releaseNotes) : null;
  }

  getReleaseUrl() {
    return this.releaseUrl;
  }
}

module.exports = Release;
