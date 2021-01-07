const { EOL } = require('os');
const { format, parseGitUrl } = require('../util');
const Plugin = require('./Plugin');

const options = { write: false };
const changelogFallback = 'git log --pretty=format:"* %s (%h)"';

class GitBase extends Plugin {
  getInitialOptions(options, namespace) {
    return Object.assign({}, options[namespace], { isUpdate: options.isUpdate });
  }
  async init() {
    this.remoteUrl = await this.getRemoteUrl();
    await this.fetch();
    const repo = parseGitUrl(this.remoteUrl);
    const latestTagName = await this.getLatestTagName(repo);
    const secondLatestTagName = this.options.isUpdate ? await this.getSecondLatestTagName(latestTagName) : null;
    const tagTemplate = this.options.tagName || ((latestTagName || '').match(/^v/) ? 'v${version}' : '${version}');
    this.setContext({ repo, tagTemplate, latestTagName, secondLatestTagName });
    this.config.setContext({ latestTag: latestTagName });
  }

  getName() {
    return this.getContext('repo.project');
  }

  getLatestVersion() {
    const latestTagName = this.getContext('latestTagName');
    return latestTagName ? latestTagName.replace(/^v/, '') : null;
  }

  async getChangelog() {
    const { isUpdate, latestTagName, secondLatestTagName } = this.getContext();
    const context = { latestTag: latestTagName, from: latestTagName, to: 'HEAD' };
    const { changelog } = this.options;
    if (!changelog) return null;

    if (latestTagName && isUpdate) {
      context.from = secondLatestTagName;
      context.to = `${latestTagName}^1`;
    }

    if (!context.from && changelog.includes('${from}')) {
      return this.exec(changelogFallback);
    }

    return this.exec(changelog, { context, options });
  }

  bump(version) {
    const { tagTemplate } = this.getContext();
    const context = Object.assign(this.config.getContext(), { version });
    const tagName = format(tagTemplate, context) || version;
    this.setContext({ version, tagName });
    this.config.setContext({ tagName });
  }

  isRemoteName(remoteUrlOrName) {
    return remoteUrlOrName && !remoteUrlOrName.includes('/');
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
      throw new Error(`Unable to fetch from ${this.remoteUrl}${EOL}${err.message}`);
    });
  }

  getLatestTagName(repo) {
    const context = Object.assign({ repo }, this.getContext(), { version: '*' });
    const match = format(this.options.tagName || '${version}', context);
    return this.exec(`git describe --tags --match=${match} --abbrev=0`, { options }).then(
      stdout => stdout || null,
      () => null
    );
  }

  async getSecondLatestTagName(latestTag) {
    const sha = await this.exec(`git rev-list ${latestTag || '--skip=1'} --tags --max-count=1`, {
      options
    });
    return this.exec(`git describe --tags --abbrev=0 ${sha}`, { options }).catch(() => null);
  }
}

module.exports = GitBase;
