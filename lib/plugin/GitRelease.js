const _ = require('lodash');
const retry = require('async-retry');
const { TokenError } = require('../errors');
const defaultConfig = require('../../config/release-it.json');
const GitBase = require('./GitBase');

const DEFAULT_RETRY_MIN_TIMEOUT = 1000;

class GitRelease extends GitBase {
  static isEnabled(options) {
    return options.release;
  }

  getInitialOptions(options, namespace) {
    const git = options.git || defaultConfig.git;
    const gitOptions = _.pick(git, ['tagName', 'pushRepo', 'changelog']);
    return _.defaults(options[namespace], gitOptions, { isUpdate: options.isUpdate });
  }

  async init() {
    await super.init();
    if (!this.token) {
      throw new TokenError(this.type, this.options.tokenRef);
    }
  }

  get token() {
    const { tokenRef } = this.options;
    return _.get(process.env, tokenRef, null);
  }

  async beforeRelease() {
    const { releaseNotes: script } = this.options;
    const { changelog } = this.config.getContext();
    const releaseNotes = script ? await this.exec(script) : changelog;
    this.setContext({ releaseNotes });
    if (releaseNotes !== changelog) {
      this.log.preview({ title: 'release notes', text: releaseNotes });
    }
  }

  retry(fn) {
    const { retryMinTimeout } = this.options;
    return retry(fn, {
      retries: 2,
      minTimeout: typeof retryMinTimeout === 'number' ? retryMinTimeout : DEFAULT_RETRY_MIN_TIMEOUT
    });
  }

  afterRelease() {
    const { isReleased, releaseUrl } = this.getContext();
    if (isReleased) {
      this.log.log(`🔗 ${releaseUrl}`);
    }
  }
}

module.exports = GitRelease;
