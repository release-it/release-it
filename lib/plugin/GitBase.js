const _ = require('lodash');
const { format, parseGitUrl } = require('../util');
const { GitRemoteUrlError, GitNetworkError } = require('../errors');
const Plugin = require('./Plugin');

const options = { write: false };
const changelogFallback = 'git log --pretty=format:"* %s (%h)"';

class GitBase extends Plugin {
  async init() {
    this.remoteUrl = await this.getRemoteUrl();
    if (!this.remoteUrl) {
      throw new GitRemoteUrlError();
    }
    await this.fetch();
    const repo = parseGitUrl(this.remoteUrl);
    const latestTagName = await this.getLatestTagName();
    const tagName = this.options.tagName || ((latestTagName || '').match(/^v/) ? 'v${version}' : '${version}');
    const changelog = await this.getChangelog(latestTagName);
    this.setContext({ repo, latestTagName, tagName, changelog });
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
    const tagName = this.getContext('tagName');
    this.setContext({
      version,
      tagName: format(tagName, { version }) || version,
      latestTagName: format(tagName, { version: this.getLatestVersion() })
    });
  }

  isRemoteName(remoteUrlOrName) {
    return !_.includes(remoteUrlOrName, '/');
  }

  async getRemoteUrl() {
    const remoteNameOrUrl = this.options.pushRepo || (await this.getRemote()) || 'origin';
    return this.isRemoteName(remoteNameOrUrl)
      ? this.exec(`git remote get-url ${remoteNameOrUrl}`, { options }).catch(() =>
          this.exec(`git config --get remote.${remoteNameOrUrl}.url`, { options }).catch(() => null)
        )
      : remoteNameOrUrl;
  }

  async getRemote() {
    const branchName = await this.getBranchName();
    return branchName ? await this.getRemoteForBranch(branchName) : null;
  }

  getBranchName() {
    return this.exec('git rev-parse --abbrev-ref HEAD', { options }).catch(() => null);
  }

  getRemoteForBranch(branch) {
    return this.exec(`git config --get branch.${branch}.remote`, { options }).catch(() => null);
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
