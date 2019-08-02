const _ = require('lodash');
const findUp = require('find-up');
const GitBase = require('../GitBase');
const { GitCleanWorkingDirError, GitUpstreamError, GitNoCommitsError, GitCommitError } = require('../../errors');
const prompts = require('./prompts');

const noop = Promise.resolve();
const invalidPushRepoRe = /^\S+@/;
const options = { write: false };

class Git extends GitBase {
  constructor(...args) {
    super(...args);
    this.registerPrompts(prompts);
  }

  static async isEnabled(options) {
    return options !== false && (await findUp('.git', { type: 'directory' }));
  }

  async init() {
    if (this.options.requireCleanWorkingDir && !(await this.isWorkingDirClean())) {
      throw new GitCleanWorkingDirError();
    }
    await super.init();
    if (this.options.requireUpstream && !(await this.hasUpstreamBranch())) {
      throw new GitUpstreamError();
    }
    if (this.options.requireCommits && (await this.getCommitsSinceLatestTag()) === 0) {
      throw new GitNoCommitsError();
    }
  }

  async beforeRelease() {
    if (this.options.commit) {
      if (this.options.requireCleanWorkingDir) {
        this.rollbackOnce = _.once(this.rollback.bind(this));
        process.on('SIGINT', this.rollbackOnce);
        process.on('exit', this.rollbackOnce);
      }
      const changeSet = await this.status();
      this.log.preview({ title: 'changeset', text: changeSet });
      await this.stageDir();
    }
  }

  async release() {
    const { commit, tag, push } = this.options;
    await this.step({ enabled: commit, task: () => this.commit(), label: 'Git commit', prompt: 'commit' });
    await this.step({ enabled: tag, task: () => this.tag(), label: 'Git tag', prompt: 'tag' });
    await this.step({ enabled: push, task: () => this.push(), label: 'Git push', prompt: 'push' });
  }

  hasUpstreamBranch() {
    return this.exec('git symbolic-ref HEAD', { options })
      .then(refs => this.exec(`git for-each-ref --format="%(upstream:short)" ${refs}`, { options }).then(Boolean))
      .catch(() => false);
  }

  getBranchName() {
    return this.exec('git rev-parse --abbrev-ref HEAD', { options }).catch(() => null);
  }

  tagExists(tag) {
    return this.exec(`git show-ref --tags --quiet --verify -- "refs/tags/${tag}"`, { options }).then(
      () => true,
      () => false
    );
  }

  isWorkingDirClean() {
    return this.exec('git diff-index --quiet HEAD --', { options }).then(() => true, () => false);
  }

  async getCommitsSinceLatestTag() {
    const latestTagName = await this.getLatestTagName();
    return this.exec(`git rev-list ${latestTagName}..HEAD --count`, { options }).then(Number);
  }

  stage(file) {
    if (!file || !file.length) return noop;
    const files = _.castArray(file).join(' ');
    return this.exec(`git add ${files}`).catch(err => {
      this.log.warn(`Could not stage ${files}`);
      this.debug(err);
    });
  }

  stageDir({ baseDir = '.' } = {}) {
    const { addUntrackedFiles } = this.options;
    return this.exec(`git add ${baseDir} ${addUntrackedFiles ? '--all' : '--update'}`);
  }

  reset(file) {
    const files = _.castArray(file).join(' ');
    return this.exec(`git checkout HEAD -- ${files}`).catch(err => {
      this.log.warn(`Could not reset ${files}`);
      this.debug(err);
    });
  }

  rollback() {
    this.log.info('Rolling back changes...');
    const { isCommitted, isTagged, tagName } = this.getContext();
    if (isTagged) {
      this.exec(`git tag --delete ${tagName}`);
    }
    this.exec(`git reset --hard HEAD${isCommitted ? '~1' : ''}`);
  }

  status() {
    return this.exec('git status --short --untracked-files=no', { options }).catch(() => null);
  }

  commit({ message = this.options.commitMessage, args = this.options.commitArgs } = {}) {
    return this.exec(`git commit --message="${message}" ${args || ''}`).then(
      () => this.setContext({ isCommitted: true }),
      err => {
        this.debug(err);
        if (/nothing (added )?to commit/.test(err)) {
          this.log.warn('No changes to commit. The latest commit will be tagged.');
        } else {
          throw new GitCommitError(err);
        }
      }
    );
  }

  tag({ name = this.options.tagName, annotation = this.options.tagAnnotation, args = this.options.tagArgs } = {}) {
    return this.exec(`git tag --annotate --message="${annotation}" ${args || ''} ${name}`)
      .then(() => this.setContext({ isTagged: true }))
      .catch(err => {
        const { latestTagName, tagName } = this.getContext();
        if (/tag '.+' already exists/.test(err) && latestTagName === tagName) {
          this.log.warn(`Tag "${tagName}" already exists`);
        } else {
          throw err;
        }
      });
  }

  async push({ args = this.options.pushArgs } = {}) {
    const { pushRepo } = this.options;
    let upstream = 'origin';
    if (pushRepo && !this.isRemoteName(pushRepo)) {
      // Use (only) `pushRepo` if it's configured and looks like a url
      upstream = pushRepo;
    } else if (!(await this.hasUpstreamBranch())) {
      // Start tracking upstream branch (`pushRepo` is a name if set)
      upstream = `--set-upstream ${pushRepo || upstream} ${await this.getBranchName()}`;
    } else if (pushRepo && !invalidPushRepoRe.test(pushRepo)) {
      upstream = pushRepo;
    }
    return this.exec(`git push ${args || ''} ${upstream}`);
  }

  afterRelease() {
    if (this.rollbackOnce) {
      process.removeListener('SIGINT', this.rollbackOnce);
      process.removeListener('exit', this.rollbackOnce);
    }
  }
}

module.exports = Git;
