const path = require('path');
const _ = require('lodash');
const repoPathParse = require('parse-repo');
const { format } = require('./util');
const Log = require('./log');
const Shell = require('./shell');
const {
  GitRepoError,
  GitRemoteUrlError,
  GitCleanWorkingDirError,
  GitUpstreamError,
  GitCloneError,
  GitCommitError,
  DistRepoStageDirError,
  CreateChangelogError
} = require('./errors');
const { debugGit } = require('./debug');
const { git: defaults } = require('../conf/release-it.json');

const noop = Promise.resolve();
const commitRefRe = /#.+$/;
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

  validateStageDir(stageDir) {
    if (stageDir && !this.shell.isSubDir(stageDir)) {
      throw new DistRepoStageDirError(stageDir);
    }
  }

  isGitRepo() {
    return this.shell.run('git rev-parse --git-dir', { isReadOnly: true }).then(() => true, () => false);
  }

  getRootDir() {
    return this.shell.run('git rev-parse --show-toplevel', { isReadOnly: true }).catch(() => null);
  }

  async isInGitRootDir() {
    const rootDir = await this.getRootDir();
    return rootDir && path.relative(process.cwd(), rootDir) === '';
  }

  hasUpstreamBranch() {
    // TODO: fix up this work-around for Windows
    return this.shell
      .run('git symbolic-ref HEAD', { isReadOnly: true })
      .then(refs =>
        this.shell.run(`git for-each-ref --format="%(upstream:short)" ${refs}`, { isReadOnly: true }).then(Boolean)
      )
      .catch(() => false);
  }

  getBranchName() {
    return this.shell.run('git rev-parse --abbrev-ref HEAD', { isReadOnly: true }).catch(() => null);
  }

  tagExists(tag) {
    return this.shell
      .run(`git show-ref --tags --quiet --verify -- "refs/tags/${tag}"`, { isReadOnly: true })
      .then(() => true, () => false);
  }

  isRemoteName(remoteUrlOrName) {
    return !_.includes(remoteUrlOrName, '/');
  }

  getRemoteUrl() {
    const remoteUrlOrName = this.options.pushRepo;
    return this.isRemoteName(remoteUrlOrName)
      ? this.shell.run(`git config --get remote.${remoteUrlOrName}.url`, { isReadOnly: true }).catch(() => null)
      : Promise.resolve(remoteUrlOrName);
  }

  isWorkingDirClean() {
    return this.shell
      .run('git diff-index --name-only HEAD --exit-code', { isReadOnly: true })
      .then(() => true, () => false);
  }

  clone(remoteUrl, targetDir) {
    const commitRef = remoteUrl.match(commitRefRe);
    const branch = commitRef && commitRef[0] ? `-b ${commitRef[0].replace(/^#/, '')}` : '';
    const sanitizedRemoteUrl = remoteUrl.replace(commitRef, '');
    return this.shell.run(`git clone ${sanitizedRemoteUrl} ${branch} --single-branch ${targetDir}`).then(
      () => sanitizedRemoteUrl,
      err => {
        this.log.error(`Unable to clone ${remoteUrl}`);
        throw new GitCloneError(err);
      }
    );
  }

  stage(file) {
    const files = _.castArray(file).join(' ');
    return this.shell.run(`git add ${files}`).catch(err => {
      debugGit(err);
      this.log.warn(`Could not stage ${files}`);
    });
  }

  stageDir({ baseDir = '.' } = {}) {
    const { addUntrackedFiles } = this.options;
    return this.shell.run(`git add ${baseDir} ${addUntrackedFiles ? '--all' : '--update'}`);
  }

  reset(file) {
    const files = _.castArray(file).join(' ');
    return this.shell.run(`git checkout HEAD -- ${files}`).catch(err => {
      debugGit(err);
      this.log.warn(`Could not reset ${files}`);
    });
  }

  status() {
    return this.shell.run('git status --short --untracked-files=no', { isReadOnly: true });
  }

  commit({ message = this.options.commitMessage, args = '' } = {}) {
    return this.shell.runTemplateCommand(`git commit --message="${message}" ${args}`).catch(err => {
      debugGit(err);
      if (/nothing (added )?to commit/.test(err)) {
        this.log.warn('No changes to commit. The latest commit will be tagged.');
      } else {
        throw new GitCommitError(err);
      }
    });
  }

  tag({ name = this.options.tagName, annotation = this.options.tagAnnotation, args = '' } = {}) {
    return this.shell.runTemplateCommand(`git tag --annotate --message="${annotation}" ${args} ${name}`);
  }

  getLatestTag() {
    return this.shell
      .run('git describe --tags --abbrev=0', { isReadOnly: true })
      .then(stdout => (stdout ? stdout.replace(/^v/, '') : null), () => null);
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
    return this.shell.run(`git push --follow-tags ${pushArgs} ${upstream}`);
  }

  async getChangelog(command) {
    let run = noop;
    if (command && (await this.isInGitRootDir())) {
      if (command.match(/\[REV_RANGE\]/)) {
        const latestTag = format(this.options.tagName, { version: await this.getLatestTag() });
        const hasTag = await this.tagExists(latestTag);
        const cmd = command.replace(/\[REV_RANGE\]/, hasTag ? `${latestTag}...HEAD` : '');
        run = this.shell.run(cmd, { isReadOnly: true });
      } else if (!/^.?git log/.test(command)) {
        run = this.shell.runTemplateCommand(command, { isReadOnly: true });
      } else {
        run = this.shell.run(command, { isReadOnly: true });
      }
    }
    return run.catch(err => {
      debugGit(err);
      throw new CreateChangelogError(command);
    });
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
