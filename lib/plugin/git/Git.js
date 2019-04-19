const _ = require('lodash');
const GitBase = require('../GitBase');
const prompts = require('./prompts');
const { hasAccess } = require('../../util');
const { GitRepoError, GitCleanWorkingDirError, GitUpstreamError, GitCommitError } = require('../../errors');

const noop = Promise.resolve();
const invalidPushRepoRe = /^\S+@/;
const options = { write: false };

class Git extends GitBase {
  constructor(...args) {
    super(...args);
    this.registerPrompts(prompts);
  }

  static isEnabled(options) {
    return hasAccess('.git') && options !== false;
  }

  async init() {
    if (!(await this.isGitRepo())) {
      throw new GitRepoError();
    }
    if (this.options.requireCleanWorkingDir && !(await this.isWorkingDirClean())) {
      throw new GitCleanWorkingDirError();
    }
    await super.init();
    if (this.options.requireUpstream && !(await this.hasUpstreamBranch())) {
      throw new GitUpstreamError();
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
    this.isTagged && this.exec(`git tag --delete ${this.getContext('tagName')}`);
    this.exec(`git reset --hard HEAD${this.isCommitted ? '~1' : ''}`);
  }

  status() {
    return this.exec('git status --short --untracked-files=no', { options }).catch(() => null);
  }

  commit({ message = this.options.commitMessage, args = this.options.commitArgs } = {}) {
    return this.exec(`git commit --message="${message}" ${args || ''}`).then(
      () => (this.isCommitted = true),
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
    return this.exec(`git tag --annotate --message="${annotation}" ${args || ''} ${name}`).then(
      () => (this.isTagged = true)
    );
  }

  async push({ args = this.options.pushArgs } = {}) {
    const { pushRepo } = this.options;
    let upstream = 'origin';
    if (pushRepo && !this.isRemoteName(pushRepo)) {
      upstream = pushRepo;
    } else if (!(await this.hasUpstreamBranch())) {
      upstream = `-u ${pushRepo || upstream} ${await this.getBranchName()}`;
    } else if (pushRepo && !invalidPushRepoRe.test(pushRepo)) {
      upstream = pushRepo;
    }
    return this.exec(`git push --follow-tags ${args || ''} ${upstream}`);
  }

  afterRelease() {
    if (this.rollbackOnce) {
      process.removeListener('SIGINT', this.rollbackOnce);
      process.removeListener('exit', this.rollbackOnce);
    }
  }
}

module.exports = Git;
