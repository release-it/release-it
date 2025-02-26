import { EOL } from 'node:os';
import { format, parseGitUrl } from '../util.js';
import Plugin from './Plugin.js';

const options = { write: false };
const changelogFallback = 'git log --pretty=format:"* %s (%h)"';

class GitBase extends Plugin {
  async init() {
    const remoteUrl = await this.getRemoteUrl();
    await this.fetch(remoteUrl);

    const branchName = await this.getBranchName();
    const repo = parseGitUrl(remoteUrl);
    this.setContext({ remoteUrl, branchName, repo });
    this.config.setContext({ remoteUrl, branchName, repo });

    const latestTag = await this.getLatestTagName();
    const secondLatestTag = !this.config.isIncrement ? await this.getSecondLatestTagName(latestTag) : null;
    const tagTemplate = this.options.tagName || ((latestTag || '').match(/^v/) ? 'v${version}' : '${version}');
    this.config.setContext({ latestTag, secondLatestTag, tagTemplate });
  }

  getName() {
    const repo = this.getContext('repo');
    return repo.project;
  }

  getLatestVersion() {
    const { tagTemplate, latestTag } = this.config.getContext();
    const prefix = format(tagTemplate.replace(/\$\{version\}/, ''), this.config.getContext());
    return latestTag ? latestTag.replace(prefix, '').replace(/^v/, '') : null;
  }

  async getChangelog() {
    const { snapshot } = this.config.getContext();
    const { latestTag, secondLatestTag } = this.config.getContext();
    const context = { latestTag, from: latestTag, to: 'HEAD' };
    const { changelog } = this.options;
    if (!changelog) return null;

    if (latestTag && !this.config.isIncrement) {
      context.from = secondLatestTag;
      context.to = `${latestTag}^1`;
    }

    // For now, snapshots do not get a changelog, as it often goes haywire (easy to add to release manually)
    if (snapshot) return '';

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

  fetch(remoteUrl) {
    return this.exec('git fetch').catch(err => {
      this.debug(err);
      throw new Error(`Unable to fetch from ${remoteUrl}${EOL}${err.message}`);
    });
  }

  getLatestTagName() {
    const context = Object.assign({}, this.config.getContext(), { version: '*' });
    const match = format(this.options.tagMatch || this.options.tagName || '${version}', context);
    const exclude = this.options.tagExclude ? ` --exclude=${format(this.options.tagExclude, context)}` : '';
    if (this.options.getLatestTagFromAllRefs) {
      return this.exec(
        `git -c "versionsort.suffix=-" for-each-ref --count=1 --sort=-v:refname --format="%(refname:short)" refs/tags/${match}`,
        { options }
      ).then(
        stdout => stdout || null,
        () => null
      );
    } else {
      return this.exec(`git describe --tags --match=${match} --abbrev=0${exclude}`, { options }).then(
        stdout => stdout || null,
        () => null
      );
    }
  }

  async getSecondLatestTagName(latestTag) {
    const sha = await this.exec(`git rev-list ${latestTag || '--skip=1'} --tags --max-count=1`, {
      options
    });
    return this.exec(`git describe --tags --abbrev=0 "${sha}^"`, { options }).catch(() => null);
  }
}

export default GitBase;
