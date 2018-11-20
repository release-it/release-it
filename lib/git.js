const { EOL } = require('os');
const _ = require('lodash');
const { format } = require('./util');
const { run, runTemplateCommand } = require('./shell');
const { config } = require('./config');
const { log, warn, logError } = require('./log');
const { GitCloneError, GitCommitError, CreateChangelogError } = require('./errors');
const { debugGit } = require('./debug');

const noop = Promise.resolve();
const commitRefRe = /#.+$/;
const invalidPushRepoRe = /^\S+@/;

const isGitRepo = () => run('git rev-parse --git-dir', { isReadOnly: true }).then(() => true, () => false);

const hasUpstream = () =>
  run('git rev-parse --abbrev-ref --symbolic-full-name @{u}', { isReadOnly: true }).then(() => true, () => false);

const getBranchName = () => run('git rev-parse --abbrev-ref HEAD', { isReadOnly: true }).catch(() => null);

const tagExists = tag =>
  run(`git show-ref --tags --quiet --verify -- "refs/tags/${tag}"`, { isReadOnly: true }).then(() => true, () => false);

const isRemoteName = remoteUrlOrName => !_.includes(remoteUrlOrName, '/');

const getRemoteUrl = (remoteUrlOrName = 'origin') =>
  isRemoteName(remoteUrlOrName)
    ? run(`git config --get remote.${remoteUrlOrName}.url`, { isReadOnly: true }).catch(() => null)
    : Promise.resolve(remoteUrlOrName);

const isWorkingDirClean = () =>
  run('git diff-index --name-only HEAD --exit-code', { isReadOnly: true }).then(() => true, () => false);

const hasChanges = () => isWorkingDirClean().then(isClean => !isClean);

const clone = (repo, dir) => {
  const commitRef = repo.match(commitRefRe);
  const branch = commitRef && commitRef[0] ? `-b ${commitRef[0].replace(/^#/, '')}` : '';
  const cleanRepo = repo.replace(commitRef, '');
  return run(`git clone ${cleanRepo} ${branch} --single-branch ${dir}`, { isReadOnly: true }).catch(err => {
    logError(`Unable to clone ${repo}`);
    throw new GitCloneError(err);
  });
};

const stage = file => {
  if (file) {
    const files = typeof file === 'string' ? file : file.join(' ');
    return run(`git add ${files}`).catch(err => {
      debugGit(err);
      warn(`Could not stage ${file}`);
    });
  } else {
    return noop;
  }
};

const stageDir = ({ baseDir = '.', addUntrackedFiles }) =>
  run(`git add ${baseDir} ${addUntrackedFiles ? '--all' : '--update'}`);

const status = () =>
  run('git status --short --untracked-files=no', { isReadOnly: true }).then(stdout => {
    !config.isVerbose && config.isInteractive && log(stdout);
  });

const commit = ({ path = '.', message, version, args = '' }) =>
  run(`git commit --message="${format(message, version)}" ${args}`, path).catch(err => {
    debugGit(err);
    if (/nothing to commit/.test(err)) {
      warn('No changes to commit. The latest commit will be tagged.');
    } else {
      throw new GitCommitError(err);
    }
  });

const tag = ({ version, name, annotation, args = '' }) => {
  const message = format(annotation, version);
  const formattedVersion = format(name, version);
  return run(`git tag --annotate --message="${message}" ${args} ${formattedVersion}`).catch(err => {
    debugGit(err);
    warn(`Could not tag. Does tag "${version}" already exist?`);
  });
};

const getLatestTag = () =>
  run('git describe --tags --abbrev=0', { isReadOnly: true }).then(
    stdout => {
      return stdout ? stdout.replace(/^v/, '') : null;
    },
    () => null
  );

const push = async ({ pushRepo = '', hasUpstreamBranch, args = '' } = {}) => {
  const remoteName = pushRepo && isRemoteName(pushRepo) ? pushRepo : 'origin';
  const setUpstream = hasUpstreamBranch === false ? `-u ${remoteName} ${await getBranchName()}` : '';
  const repository = setUpstream ? '' : invalidPushRepoRe.test(pushRepo) ? 'origin' : pushRepo;
  return run(`git push --follow-tags ${args} ${repository} ${setUpstream}`);
};

const runChangelogCommand = command =>
  runTemplateCommand(command, { isReadOnly: true })
    .then(stdout => {
      if (config.isVerbose) {
        process.stdout.write(EOL);
      }
      return stdout;
    })
    .catch(err => {
      debugGit(err);
      throw new CreateChangelogError(command);
    });

const getChangelog = ({ changelogCommand, tagName, latestVersion }) => {
  if (changelogCommand) {
    if (changelogCommand.match(/\[REV_RANGE\]/)) {
      const latestTag = format(tagName, latestVersion);
      return tagExists(latestTag).then(hasTag => {
        const command = changelogCommand.replace(/\[REV_RANGE\]/, hasTag ? `${latestTag}...HEAD` : '');
        return runChangelogCommand(command);
      });
    } else {
      return runChangelogCommand(changelogCommand);
    }
  } else {
    return noop;
  }
};

const isSameRepo = (repoA, repoB) => repoA.repository === repoB.repository && repoA.host === repoB.host;

module.exports = {
  isGitRepo,
  hasUpstream,
  getBranchName,
  tagExists,
  getRemoteUrl,
  isWorkingDirClean,
  hasChanges,
  clone,
  stage,
  stageDir,
  status,
  commit,
  tag,
  getLatestTag,
  push,
  runChangelogCommand,
  getChangelog,
  isSameRepo
};
