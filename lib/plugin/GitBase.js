const _ = require('lodash');
const { format, parseGitUrl } = require('../util');
const { GitRemoteUrlError, GitNetworkError } = require('../errors');
const Plugin = require('./Plugin');

const options = { write: false };
const changelogFallback = 'git log --pretty=format:"* %s (%h)"';

class GitBase extends Plugin {
  async init() {
    this.remoteUrl = this.options.remoteUrl || (await this.getRemoteUrl());
    if (!this.remoteUrl) {
      throw new GitRemoteUrlError();
    }
    await this.fetch();
    const repo = parseGitUrl(this.remoteUrl);
    const latestTagName = await this.getLatestTagName();
    const changelog = await this.getChangelog(latestTagName);
    this.setContext({ repo, latestTagName, changelog });
  }

  async getChangelog(latestTag) {
    const context = { latestTag };
    let { changelog } = this.options;
    if (!changelog) return null;
    if (!latestTag && changelog.includes('${latestTag}')) {
      changelog = changelogFallback;
    }
    return await this.exec(changelog, { context, options });
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

  async getRemoteUrl() {
    const remoteNameOrUrl = this.options.pushRepo || (await this.getBranchUpstreamRemote()) || 'origin';
    return this.isRemoteName(remoteNameOrUrl)
      ? this.exec(`git config --get remote.${remoteNameOrUrl}.url`, { options }).catch(() => null)
      : remoteNameOrUrl;
  }

  async getBranchUpstreamRemote() {
    let remote = null;
    const branchName = await this.exec('git rev-parse --abbrev-ref HEAD', { options });
    if (branchName) {
      remote = await this.exec(`git config --get branch.${branchName}.remote`, { options }).catch(() => null);
    }
    return remote;
  }

  fetch() {
    return this.exec('git fetch').catch(err => {
      this.debug(err);
      throw new GitNetworkError(err, this.remoteUrl);
    });
  }

  getLatestTagName() {
    return this.exec('git describe --tags --abbrev=0', { options }).then(
      stdout => stdout || null,
      () => null
    );
  }
}

module.exports = GitBase;
