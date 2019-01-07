const path = require('path');
const _ = require('lodash');
const repoPathParse = require('parse-repo');
const Log = require('./log');
const Shell = require('./shell');
const {
  GitRepoError,
  GitRemoteUrlError,
  GitCleanWorkingDirError,
  GitUpstreamError,
  GitCommitError
} = require('./errors');
const { debugGit: debug } = require('./debug');
const { git: defaults } = require('../conf/release-it.json');

const invalidPushRepoRe = /^\S+@/;

class Git {
  constructor(...args) {
    const options = Object.assign({}, ...args);
    this.options = _.defaults(options, defaults);
    this.log = options.log || new Log();
    this.shell = options.shell || new Shell();
  }

  async init() {
    this.remoteUrl = await this.getRemoteUrl();
    this.hasUpstream = await this.hasUpstreamBranch();
    this.latestTag = await this.getLatestTag();
    this.isRootDir = await this.isInGitRootDir();
    this.repo = this.remoteUrl && repoPathParse(this.remoteUrl);
  }

  async validate() {
    if (!(await this.isGitRepo())) {
      throw new GitRepoError();
    }
    if (!this.remoteUrl) {
      throw new GitRemoteUrlError();
    }
    if (this.options.requireCleanWorkingDir && !(await this.isWorkingDirClean())) {
      throw new GitCleanWorkingDirError();
    }
    if (this.options.requireUpstream && !this.hasUpstream) {
      throw new GitUpstreamError();
    }
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
    return this.shell.run('git diff-index --name-only HEAD --exit-code').then(() => true, () => false);
  }

  stage(file) {
    const files = _.castArray(file).join(' ');
    return this.shell.run(`git add ${files}`, Shell.writes).catch(err => {
      this.log.warn(`Could not stage ${files}`);
      debug(err);
    });
  }

  stageDir({ baseDir = '.' } = {}) {
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
    return this.shell.run('git status --short --untracked-files=no');
  }

  commit({ message = this.options.commitMessage, args = '' } = {}) {
    return this.shell.runTemplateCommand(`git commit --message="${message}" ${args}`, Shell.writes).catch(err => {
      debug(err);
      if (/nothing (added )?to commit/.test(err)) {
        this.log.warn('No changes to commit. The latest commit will be tagged.');
      } else {
        throw new GitCommitError(err);
      }
    });
  }

  tag({ name = this.options.tagName, annotation = this.options.tagAnnotation, args = '' } = {}) {
    return this.shell.runTemplateCommand(`git tag --annotate --message="${annotation}" ${args} ${name}`, Shell.writes);
  }

  getLatestTag() {
    return this.shell.run('git describe --tags --abbrev=0').then(stdout => stdout || null, () => null);
  }

  async push({ pushArgs = '' } = {}) {
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

  isSameRepo(otherClient) {
    return this.repo.repository === otherClient.repo.repository && this.repo.host === otherClient.repo.host;
  }

  handleTagOptions(otherClient) {
    const isSameRepo = this.isSameRepo(otherClient);
    const { tag, tagName } = this.options;
    const other = otherClient.options;
    this.options.tag = (tag && !other.tag) || (tag && !isSameRepo) || (isSameRepo && tagName !== other.tagName);
  }
}

module.exports = Git;
