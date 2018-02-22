const { format } = require('./util');
const { run, runTemplateCommand } = require('./shell');
const { config } = require('./config');
const log = require('./log');
const { debugGit } = require('./debug');

const noop = Promise.resolve();
const commitRefRe = /#.+$/;

const isGitRepo = () => run('git rev-parse --git-dir', { isReadOnly: true }).then(() => true, () => false);

const hasUpstream = () =>
  run('git rev-parse --abbrev-ref --symbolic-full-name @{u}', { isReadOnly: true }).then(() => true, () => false);

const getBranchName = () => run('git rev-parse --abbrev-ref HEAD', { isReadOnly: true }).catch(() => null);

const tagExists = tag =>
  run(`git show-ref --tags --quiet --verify -- "refs/tags/${tag}"`, { isReadOnly: true }).then(() => true, () => false);

const getRemoteUrl = () => run('git config --get remote.origin.url', { isReadOnly: true }).catch(() => null);

const isWorkingDirClean = () =>
  run('git diff-index --name-only HEAD --exit-code', { isReadOnly: true }).then(() => true, () => false);

const hasChanges = () => isWorkingDirClean().then(isClean => !isClean);

const clone = (repo, dir) => {
  const commitRef = repo.match(commitRefRe);
  const branch = commitRef && commitRef[0] ? `-b ${commitRef[0].replace(/^#/, '')}` : '';
  const cleanRepo = repo.replace(commitRef, '');
  return run(`git clone ${cleanRepo} ${branch} --single-branch ${dir}`, { isReadOnly: true }).catch(err => {
    log.error(`Unable to clone ${repo}`);
    throw new Error(err);
  });
};

const stage = file => {
  if (file) {
    const files = typeof file === 'string' ? file : file.join(' ');
    return run(`git add ${files}`).catch(err => {
      debugGit(err);
      log.warn(`Could not stage ${file}`);
    });
  } else {
    return noop;
  }
};

const stageDir = (baseDir = '.') => run(`git add ${baseDir} --update`);

const status = () =>
  run('git status --short --untracked-files=no', { isReadOnly: true }).then(stdout => {
    !config.isVerbose && config.isInteractive && log.log(stdout);
  });

const commit = ({ path, message, version, args = '' }) =>
  run(
    `git commit ${config.isForce ? '--allow-empty ' : ''}--message="${format(message, version)}" ${args}`,
    path
  ).catch(err => {
    debugGit(err);
    log.warn('No changes to commit. The latest commit will be tagged.');
  });

const tag = (version, tag, annotation) => {
  const force = config.isForce ? '--force ' : '';
  const message = format(annotation, version);
  const formattedVersion = format(tag, version);
  return run(`git tag ${force}--annotate --message="${message}" ${formattedVersion}`).catch(err => {
    debugGit(err);
    log.warn(`Could not tag. Does tag "${version}" already exist? Use --force to move a tag.`);
  });
};

const getLatestTag = () =>
  run('git describe --tags --abbrev=0', { isReadOnly: true }).then(stdout => {
    return stdout ? stdout.replace(/^v/, '') : null;
  }, () => null);

const push = async ({ pushUrl, hasUpstreamBranch, args = '' }) => {
  const repository = pushUrl || '';
  const setUpstream = hasUpstreamBranch === false ? `--set-upstream origin ${await getBranchName()}` : '';
  return run(`git push --follow-tags ${args} ${repository} ${setUpstream}`);
};

const runChangelogCommand = command =>
  runTemplateCommand(command, { isReadOnly: true })
    .then(stdout => {
      if (config.isVerbose) {
        process.stdout.write('\n');
      }
      return stdout;
    })
    .catch(err => {
      debugGit(err);
      throw new Error(`Could not create changelog (${command})`);
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
