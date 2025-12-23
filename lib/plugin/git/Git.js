import { EOL } from 'node:os';
import { spawn } from 'node:child_process';
import matcher from 'wildcard-match';
import { format, e, fixArgs, once, castArray } from '../../util.js';
import GitBase from '../GitBase.js';
import prompts from './prompts.js';

const noop = Promise.resolve();
const invalidPushRepoRe = /^\S+@/;
const options = { write: false };

const docs = 'https://git.io/release-it-git';

async function isGitRepo() {
  return await new Promise(resolve => {
    const process = spawn('git', ['rev-parse', '--git-dir']);
    process.on('close', code => resolve(code === 0));
    process.on('error', () => resolve(false));
  });
}

class Git extends GitBase {
  constructor(...args) {
    super(...args);
    this.registerPrompts(prompts);
  }

  static async isEnabled(options) {
    return options !== false && (await isGitRepo());
  }

  async init() {
    if (this.options.requireBranch && !(await this.isRequiredBranch(this.options.requireBranch))) {
      throw e(`Must be on branch ${this.options.requireBranch}`, docs);
    }
    if (this.options.requireCleanWorkingDir && !(await this.isWorkingDirClean())) {
      throw e(`Working dir must be clean.${EOL}Please stage and commit your changes.`, docs);
    }

    await super.init();

    const remoteUrl = this.getContext('remoteUrl');
    if (this.options.push && !remoteUrl) {
      throw e(`Could not get remote Git url.${EOL}Please add a remote repository.`, docs);
    }
    if (this.options.requireUpstream && !(await this.hasUpstreamBranch())) {
      throw e(`No upstream configured for current branch.${EOL}Please set an upstream branch.`, docs);
    }
    if (this.options.requireCommits && (await this.getCommitsSinceLatestTag(this.options.commitsPath)) === 0) {
      throw e(`There are no commits since the latest tag.`, docs, this.options.requireCommitsFail);
    }
  }

  rollback() {
    this.log.info('Rolling back changes...');
    const { tagName } = this.config.getContext();
    const { isCommitted, isTagged } = this.getContext();
    if (isTagged) {
      this.log.info(`Deleting local tag ${tagName}`);
      this.exec(`git tag --delete ${tagName}`);
    }

    this.log.info(`Resetting local changes made`);
    this.exec(`git reset --hard HEAD${isCommitted ? '~1' : ''}`);
  }

  enableRollback() {
    this.rollbackOnce = once(this.rollback.bind(this));
    process.on('SIGINT', this.rollbackOnce);
    process.on('exit', this.rollbackOnce);
  }

  disableRollback() {
    if (this.rollbackOnce) {
      process.removeListener('SIGINT', this.rollbackOnce);
      process.removeListener('exit', this.rollbackOnce);
    }
  }

  async beforeRelease() {
    if (this.options.commit) {
      if (this.options.requireCleanWorkingDir) {
        this.enableRollback();
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
    return !!(await this.step({ enabled: push, task: () => this.push(), label: 'Git push', prompt: 'push' }));
  }

  async isRequiredBranch() {
    const branch = await this.getBranchName();
    const requiredBranches = castArray(this.options.requireBranch);
    const [branches, negated] = requiredBranches.reduce(
      ([p, n], b) => (b.startsWith('!') ? [p, [...n, b.slice(1)]] : [[...p, b], n]),
      [[], []]
    );
    return (
      (branches.length > 0 ? matcher(branches)(branch) : true) &&
      (negated.length > 0 ? !matcher(negated)(branch) : true)
    );
  }

  async hasUpstreamBranch() {
    const ref = await this.exec('git symbolic-ref HEAD', { options });
    const branch = await this.exec(`git for-each-ref --format="%(upstream:short)" ${ref}`, { options }).catch(
      () => null
    );
    return Boolean(branch);
  }

  tagExists(tag) {
    return this.exec(`git show-ref --tags --quiet --verify -- refs/tags/${tag}`, { options }).then(
      () => true,
      () => false
    );
  }

  isWorkingDirClean() {
    return this.exec('git diff --quiet HEAD', { options }).then(
      () => true,
      () => false
    );
  }

  async getCommitsSinceLatestTag(commitsPath = '') {
    const latestTagName = await this.getLatestTagName();
    const ref = latestTagName ? `${latestTagName}..HEAD` : 'HEAD';
    return this.exec(`git rev-list ${ref} --count ${commitsPath ? `-- ${commitsPath}` : ''}`, { options }).then(Number);
  }

  async getUpstreamArgs(pushRepo) {
    if (pushRepo && !this.isRemoteName(pushRepo)) {
      // Use (only) `pushRepo` if it's configured and looks like a url
      return [pushRepo];
    } else if (!(await this.hasUpstreamBranch())) {
      // Start tracking upstream branch (`pushRepo` is a name if set)
      return ['--set-upstream', pushRepo || 'origin', await this.getBranchName()];
    } else if (pushRepo && !invalidPushRepoRe.test(pushRepo)) {
      return [pushRepo];
    } else {
      return [];
    }
  }

  stage(file) {
    if (!file || !file.length) return noop;
    const files = castArray(file);
    return this.exec(['git', 'add', ...files]).catch(err => {
      this.log.warn(`Could not stage ${files}`);
      this.debug(err);
    });
  }

  stageDir({ baseDir = '.' } = {}) {
    const { addUntrackedFiles } = this.options;
    return this.exec(['git', 'add', baseDir, addUntrackedFiles ? '--all' : '--update']);
  }

  reset(file) {
    const files = castArray(file);
    return this.exec(['git', 'checkout', 'HEAD', '--', ...files]).catch(err => {
      this.log.warn(`Could not reset ${files}`);
      this.debug(err);
    });
  }

  status() {
    return this.exec('git status --short --untracked-files=no', { options }).catch(() => null);
  }

  commit({ message = this.options.commitMessage, args = this.options.commitArgs } = {}) {
    const msg = format(message, this.config.getContext());
    const commitMessageArgs = msg ? ['--message', msg] : [];
    return this.exec(['git', 'commit', ...commitMessageArgs, ...fixArgs(args)]).then(
      () => this.setContext({ isCommitted: true }),
      err => {
        this.debug(err);
        if (/nothing (added )?to commit/.test(err) || /nichts zu committen/.test(err)) {
          this.log.warn('No changes to commit. The latest commit will be tagged.');
        } else {
          throw new Error(err);
        }
      }
    );
  }

  tag({ name, annotation = this.options.tagAnnotation, args = this.options.tagArgs } = {}) {
    const message = format(annotation, this.config.getContext());
    const tagName = name || this.config.getContext('tagName');
    return this.exec(['git', 'tag', '--annotate', '--message', message, ...fixArgs(args), tagName])
      .then(() => this.setContext({ isTagged: true }))
      .catch(err => {
        const { latestTag, tagName } = this.config.getContext();
        if (/tag '.+' already exists/.test(err) && latestTag === tagName) {
          this.log.warn(`Tag "${tagName}" already exists`);
        } else {
          throw err;
        }
      });
  }

  async push({ args = this.options.pushArgs } = {}) {
    const { pushRepo } = this.options;
    const upstreamArgs = await this.getUpstreamArgs(pushRepo);
    try {
      const push = await this.exec(['git', 'push', ...fixArgs(args), ...upstreamArgs]);
      this.disableRollback();
      return push;
    } catch (error) {
      try {
        await this.rollbackTagPush();
      } catch (tagError) {
        this.log.warn(`An error was encountered when trying to rollback the tag on the remote: ${tagError.message}`);
      }

      throw error;
    }
  }

  async rollbackTagPush() {
    const { isTagged } = this.getContext();
    if (isTagged) {
      const { tagName } = this.config.getContext();
      this.log.info(`Rolling back remote tag push ${tagName}`);
      await this.exec(`git push origin --delete ${tagName}`);
    }
  }

  afterRelease() {
    this.disableRollback();
  }
}

export default Git;
