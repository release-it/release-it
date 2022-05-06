import { EOL } from 'node:os';
import { format, parseGitUrl } from '../util.js';
import Plugin from './Plugin.js';

const options = { write: false };
const changelogFallback = 'git log --pretty=format:"* %s (%h)"';

class GitBase extends Plugin {
  async init() {
    this.remoteUrl = await this.getRemoteUrl();
    await this.fetch();
    const branchName = await this.getBranchName();
    this.setContext({ branchName });
    const repo = parseGitUrl(this.remoteUrl);
    const latestTag = await this.getLatestTagName(repo);
    const secondLatestTag = !this.config.isIncrement ? await this.getSecondLatestTagName(latestTag) : null;
    const tagTemplate = this.options.tagName || ((latestTag || '').match(/^v/) ? 'v${version}' : '${version}');
    this.setContext({ repo });
    this.config.setContext({ tagTemplate, latestTag, secondLatestTag, branchName });
  }

  getName() {
    return this.getContext('repo.project');
  }

  getLatestVersion() {
    const { tagTemplate, latestTag } = this.config.getContext();
    const prefix = tagTemplate.replace(/\$\{version\}/, '');
    return latestTag ? latestTag.replace(prefix, '').replace(/^v/, '') : null;
  }

  async getChangelog() {
    const { latestTag, secondLatestTag } = this.config.getContext();
    const context = { latestTag, from: latestTag, to: 'HEAD' };
    const { changelog } = this.options;
    if (!changelog) return null;

    if (latestTag && !this.config.isIncrement) {
      context.from = secondLatestTag;
      context.to = `${latestTag}^1`;
    }

    if (!context.from && changelog.includes('${from}')) {
      return this.exec(changelogFallback);
    }

    return this.exec(changelog, { context, options });
  }

  bump(version) {
    const { tagTemplate } = this.config.getContext();
    const context = Object.assign(this.config.getContext(), { version });
    const tagName = format(tagTemplate, context) || version;
    this.setContext({ version });
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
    const match = format(this.options.tagMatch || this.options.tagName || '${version}', context);
    return this.exec(`git describe --tags --match=${match} --abbrev=0`, { options }).then(
      stdout => stdout || null,
      () => null
    );
  }

  async getSecondLatestTagName(latestTag) {
    const sha = await this.exec(`git rev-list ${latestTag || '--skip=1'} --tags --max-count=1`, {
      options
    });
    return this.exec(`git describe --tags --abbrev=0 "${sha}^"`, { options }).catch(() => null);
  }
}

export default GitBase;
