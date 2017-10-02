import { format } from './util';
import { run } from './shell';
import { config } from './config';
import * as log from './log';
import { debugGit } from './debug';

const noop = Promise.resolve();
const commitRefRe = /#.+$/;

export function isGitRepo() {
  return run('!git rev-parse --git-dir', { isReadOnly: true }).then(stdout => stdout === '.git', () => false);
}

export function tagExists(tag) {
  return run(`!git show-ref --tags --quiet --verify -- "refs/tags/${tag}"`, { isReadOnly: true }).then(
    () => true,
    () => false
  );
}

export function getRemoteUrl() {
  return run('!git config --get remote.origin.url', { isReadOnly: true }).catch(() => {
    throw new Error('Could not get remote Git url.');
  });
}

export function isWorkingDirClean() {
  return run('!git diff-index --name-only HEAD --exit-code', { isReadOnly: true }).then(() => true, () => false);
}

export function hasChanges() {
  return isWorkingDirClean().then(isClean => !isClean);
}

export function clone(repo, dir) {
  const commitRef = repo.match(commitRefRe);
  const branch = commitRef && commitRef[0] ? `-b ${commitRef[0].replace(/^#/, '')}` : '';
  const cleanRepo = repo.replace(commitRef, '');
  return run(`git clone ${cleanRepo} ${branch} --single-branch ${dir}`, { isReadOnly: true }).catch(err => {
    log.error(`Unable to clone ${repo}`);
    throw new Error(err);
  });
}

export function stage(file) {
  if (file) {
    const files = typeof file === 'string' ? file : file.join(' ');
    return run(`git add ${files}`).catch(err => {
      debugGit(err);
      log.warn(`Could not stage ${file}`);
    });
  } else {
    return noop;
  }
}

export function stageDir(baseDir = '.') {
  return run(`git add ${baseDir} --all`);
}

export function status() {
  return run('!git status --short --untracked-files=no', { isReadOnly: true }).then(stdout => {
    !config.isVerbose && config.isInteractive && log.log(stdout);
  });
}

export function commit(path, message, version) {
  return run(
    `git commit ${config.isForce ? '--allow-empty ' : ''}--message="${format(message, version)}"`,
    path
  ).catch(err => {
    debugGit(err);
    log.warn('No changes to commit. The latest commit will be tagged.');
  });
}

export function tag(version, tag, annotation) {
  const force = config.isForce ? '--force ' : '';
  const message = format(annotation, version);
  const formattedVersion = format(tag, version);
  return run(`git tag ${force}--annotate --message="${message}" ${formattedVersion}`).catch(err => {
    debugGit(err);
    log.warn(`Could not tag. Does tag "${version}" already exist? Use --force to move a tag.`);
  });
}

export function getLatestTag() {
  return run('!git describe --tags --abbrev=0', { isReadOnly: true }).then(stdout => {
    return stdout ? stdout.replace(/^v/, '') : null;
  }, () => null);
}

export function push(pushUrl) {
  const repository = pushUrl || '';
  return run(`git push --follow-tags ${repository}`);
}

function runChangelogCommand(command) {
  return run(command, { isReadOnly: true })
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
}

export function getChangelog({ changelogCommand, tagName, latestVersion }) {
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
}
