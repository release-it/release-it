import _ from 'lodash';
import { readJSON } from '../util.js';
import GitBase from './GitBase.js';

const defaultConfig = readJSON(new URL('../../config/release-it.json', import.meta.url));

class GitRelease extends GitBase {
  static isEnabled(options) {
    return options.release;
  }

  getInitialOptions(options) {
    const baseOptions = super.getInitialOptions(...arguments);
    const git = options.git || defaultConfig.git;
    const gitOptions = _.pick(git, ['tagExclude', 'tagName', 'tagMatch', 'pushRepo', 'changelog']);
    return _.defaults(baseOptions, gitOptions);
  }

  get token() {
    const { tokenRef } = this.options;
    return _.get(process.env, tokenRef, null);
  }

  async beforeRelease() {
    const { releaseNotes: script } = this.options;
    const { changelog } = this.config.getContext();
    const releaseNotes = script ? await this.processReleaseNotes(script) : changelog;
    this.setContext({ releaseNotes });
    if (releaseNotes !== changelog) {
      this.log.preview({ title: 'release notes', text: releaseNotes });
    }
  }

  async processReleaseNotes(script) {
    if (typeof script === 'function') {
      const ctx = Object.assign({}, this.config.getContext(), { [this.namespace]: this.getContext() });
      return script(ctx);
    } else {
      return this.exec(script);
    }
  }

  afterRelease() {
    const { isReleased, releaseUrl } = this.getContext();
    if (isReleased) {
      this.log.log(`🔗 ${releaseUrl}`);
    }
  }
}

export default GitRelease;
