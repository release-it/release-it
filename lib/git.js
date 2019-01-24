const path = require('path');
const _ = require('lodash');
const { parseGitUrl } = require('./util');
const Log = require('./log');
const Shell = require('./shell');
const {
  GitRepoError,
  GitRemoteUrlError,
  GitCleanWorkingDirError,
  GitUpstreamError,
  GitCommitError,
  GitNetworkError
} = require('./errors');
const debug = require('debug')('release-it:git');
const { git: defaults } = require('../conf/release-it.json');

const noop = Promise.resolve();
const invalidPushRepoRe = /^\S+@/;

class Git {
  constructor(...args) {
    const options = Object.assign({}, ...args);
    this.options = _.defaults(options, defaults);
    this.log = options.log || new Log();
    this.shell = options.shell || new Shell();
  }

  async init() {
    if (this.options.skip) return;

    if (!(await this.isGitRepo())) {
      throw new GitRepoError();
    }

    const [remoteUrl, isWorkingDirClean, hasUpstream, isRootDir] = await Promise.all([
      this.getRemoteUrl(),
      this.isWorkingDirClean(),
      this.hasUpstreamBranch(),
      this.isInGitRootDir()
    ]);

    this.remoteUrl = remoteUrl;
    this.isRootDir = isRootDir;
    this.repo = remoteUrl && parseGitUrl(remoteUrl);

    if (!this.remoteUrl) {
      throw new GitRemoteUrlError();
    }
    if (this.options.requireCleanWorkingDir && !isWorkingDirClean) {
      throw new GitCleanWorkingDirError();
    }
    if (this.options.requireUpstream && !hasUpstream) {
      throw new GitUpstreamError();
    }

    await this.fetch();

    this.latestTag = await this.getLatestTag();
  }

  isGitRepo() {
    return this.shell.run('git rev-parse --git-dir').then(() => true, () => false);
  }

  getRootDir() {
    return this.shell.run('git rev-parse --show-toplevel').catch(() => null);
  }

  async isInGitRootDir() {
    const rootDir = await this.getRootDir();
    return rootDir && path.relative(process.cwd(), rootDir) === '';
  }

  hasUpstreamBranch() {
    return this.shell
      .run('git symbolic-ref HEAD')
      .then(refs => this.shell.run(`git for-each-ref --format="%(upstream:short)" ${refs}`).then(Boolean))
      .catch(() => false);
  }

  getBranchName() {
    return this.shell.run('git rev-parse --abbrev-ref HEAD').catch(() => null);
  }

  tagExists(tag) {
    return this.shell.run(`git show-ref --tags --quiet --verify -- "refs/tags/${tag}"`).then(() => true, () => false);
  }

  isRemoteName(remoteUrlOrName) {
    return !_.includes(remoteUrlOrName, '/');
  }

  getRemoteUrl() {
    const remoteUrlOrName = this.options.pushRepo;
    return this.isRemoteName(remoteUrlOrName)
      ? this.shell.run(`git config --get remote.${remoteUrlOrName}.url`).catch(() => null)
      : Promise.resolve(remoteUrlOrName);
  }

  isWorkingDirClean() {
    return this.shell.run('git diff-index --quiet HEAD --').then(() => true, () => false);
  }

  fetch() {
    return this.shell.run('git fetch').catch(err => {
      debug(err);
      throw new GitNetworkError(err, this.remoteUrl);
    });
  }

  stage(file) {
    if (!this.options.commit || !file || !file.length) return noop;
    const files = _.castArray(file).join(' ');
    return this.shell.run(`git add ${files}`, Shell.writes).catch(err => {
      this.log.warn(`Could not stage ${files}`);
      debug(err);
    });
  }

  stageDir({ baseDir = '.' } = {}) {
    if (!this.options.commit) return noop;
    const { addUntrackedFiles } = this.options;
    return this.shell.run(`git add ${baseDir} ${addUntrackedFiles ? '--all' : '--update'}`, Shell.writes);
  }

  reset(file) {
    const files = _.castArray(file).join(' ');
    return this.shell.run(`git checkout HEAD -- ${files}`).catch(err => {
      this.log.warn(`Could not reset ${files}`);
      debug(err);
    });
  }

  status() {
    return this.shell.run('git status --short --untracked-files=no').catch(() => null);
  }

  commit({ message = this.options.commitMessage, args = this.options.commitArgs } = {}) {
    return this.shell.runTemplateCommand(`git commit --message="${message}" ${args}`, Shell.writes).catch(err => {
      debug(err);
      if (/nothing (added )?to commit/.test(err)) {
        this.log.warn('No changes to commit. The latest commit will be tagged.');
      } else {
        throw new GitCommitError(err);
      }
    });
  }

  tag({ name = this.options.tagName, annotation = this.options.tagAnnotation, args = this.options.tagArgs } = {}) {
    return this.shell.runTemplateCommand(`git tag --annotate --message="${annotation}" ${args} ${name}`, Shell.writes);
  }

  getLatestTag() {
    return this.shell.run('git describe --tags --abbrev=0').then(stdout => stdout || null, () => null);
  }

  async push({ pushArgs = this.options.pushArgs } = {}) {
    const { pushRepo } = this.options;
    let upstream = 'origin';
    if (pushRepo && !this.isRemoteName(pushRepo)) {
      upstream = pushRepo;
    } else if (!(await this.hasUpstreamBranch())) {
      upstream = `-u ${pushRepo || upstream} ${await this.getBranchName()}`;
    } else if (!invalidPushRepoRe.test(pushRepo)) {
      upstream = pushRepo;
    }
    return this.shell.run(`git push --follow-tags ${pushArgs} ${upstream}`, Shell.writes);
  }
}

module.exports = Git;
