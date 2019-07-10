const _ = require('lodash');
const { format, parseGitUrl } = require('../util');
const { GitRemoteUrlError, GitNetworkError } = require('../errors');
const Plugin = require('./Plugin');

const options = { write: false };
const cache = { write: false, cache: true };

class GitBase extends Plugin {
  async init() {
    this.remoteUrl = this.options.remoteUrl || (await this.getRemoteUrl());
    if (!this.remoteUrl) {
      throw new GitRemoteUrlError();
    }
    await this.fetch();
    const repo = parseGitUrl(this.remoteUrl);
    const latestTagName = await this.getLatestTagName();
    const context = { latestTag: latestTagName };
    const changelog = await this.exec(this.getContext('changelog'), { context, options: cache });
    this.setContext({ repo, latestTagName, changelog });
  }

  getName() {
    return this.getContext('repo.project');
  }

  getLatestVersion() {
    const latestTagName = this.getContext('latestTagName');
    return latestTagName ? latestTagName.replace(/^v/, '') : null;
  }

  bump(version) {
    this.setContext({
      version,
      tagName: format(this.options.tagName, { version }) || version,
      latestTagName: format(this.options.tagName, { version: this.getLatestVersion() })
    });
  }

  isRemoteName(remoteUrlOrName) {
    return !_.includes(remoteUrlOrName, '/');
  }

  getRemoteUrl() {
    const remoteNameOrUrl = this.options.pushRepo || 'origin';
    return this.isRemoteName(remoteNameOrUrl)
      ? this.exec(`git config --get remote.${remoteNameOrUrl}.url`, { options }).catch(() => null)
      : Promise.resolve(remoteNameOrUrl);
  }

  fetch() {
    return this.exec('git fetch', { options: { cache: true } }).catch(err => {
      this.debug(err);
      throw new GitNetworkError(err, this.remoteUrl);
    });
  }

  getLatestTagName() {
    return this.exec('git describe --tags --abbrev=0', { options: cache }).then(stdout => stdout || null, () => null);
  }
}

module.exports = GitBase;
