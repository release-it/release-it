const _ = require('lodash');
const { parseGitUrl } = require('./util');
const retry = require('async-retry');
const Log = require('./log');
const Changelog = require('./changelog');
const { TokenError } = require('./errors');

const DEFAULT_RETRY_MIN_TIMEOUT = 1000;

class Release {
  constructor(...args) {
    const options = Object.assign({}, ...args);
    this.options = options;
    this.remoteUrl = options.remoteUrl;
    this.log = options.log || new Log();
    this.changelogs = options.changelogs || new Changelog();
  }

  validate() {
    if (!this.options.release) return;
    if (!this.token) {
      throw new TokenError(this.type, this.options.tokenRef);
    }
  }

  set remoteUrl(remoteUrl) {
    this.repo = remoteUrl && parseGitUrl(remoteUrl);
  }

  get token() {
    const { tokenRef } = this.options;
    return _.get(process.env, tokenRef, null);
  }

  async getNotes() {
    const { releaseNotes } = this.options;
    return releaseNotes ? await this.changelogs.generate(releaseNotes) : null;
  }

  retry(fn) {
    const { retryMinTimeout } = this.options;
    return retry(fn, {
      retries: 2,
      minTimeout: typeof retryMinTimeout === 'number' ? retryMinTimeout : DEFAULT_RETRY_MIN_TIMEOUT
    });
  }

  getReleaseUrl() {
    return this.releaseUrl;
  }
}

module.exports = Release;
