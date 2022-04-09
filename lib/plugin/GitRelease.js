const _ = require('lodash');
const defaultConfig = require('../../config/release-it.json');
const GitBase = require('./GitBase');

class GitRelease extends GitBase {
  static isEnabled(options) {
    return options.release;
  }

  getInitialOptions(options) {
    const baseOptions = super.getInitialOptions(...arguments);
    const git = options.git || defaultConfig.git;
    const gitOptions = _.pick(git, ['tagName', 'tagMatch', 'pushRepo', 'changelog']);
    return _.defaults(baseOptions, gitOptions);
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

  afterRelease() {
    const { isReleased, releaseUrl } = this.getContext();
    if (isReleased) {
      this.log.log(`🔗 ${releaseUrl}`);
    }
  }
}

module.exports = GitRelease;
