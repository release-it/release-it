const util = require('./util'), 
  run = require('./shell').run, 
  config = require('./config'), 
  when = require('when'), 
  sequence = require('when/sequence'), 
  GitHubApi = require('github'), 
  repoPathParse = require('parse-repo'), 
  log = require('./log');

const noop = when.resolve(true),
  commitRefRe = /#.+$/;
var _githubClient = null;

function isGitRepo() {
  return run('!git', 'rev-parse --git-dir');
}

function tagExists(tag) {
  return run('!git', `show-ref --tags --quiet --verify -- "refs/tags/${tag}"`).then(() => true, () => false);
}

function getRemoteUrl() {
  return run('!git', 'config --get remote.origin.url').then(result => {
    if(result && result.output) {
      return result.output.trim();
    }
    throw new Error('Could not get remote Git url.');
  });
}

function isWorkingDirClean(requireCleanWorkingDir) {
  return requireCleanWorkingDir ? run('!git', 'diff-index --name-only HEAD --exit-code').catch(() => {
    throw new Error('Working dir must be clean.');
  }) : noop;
}

function hasChanges(repo) {
  // Inverted: reject if run promise is resolved (i.e. `git diff-index` returns exit code 0)
  return when.promise(resolve => {
    run('!git', 'diff-index --name-only HEAD --exit-code').then(() => {
      if(!config.isDryRun) {
        config.setRuntimeOption(`${repo}_has_changes`, false);
        log.warn(`Nothing to commit in ${repo} repo. The latest commit will be tagged.`);
      }
      resolve();
    }).catch(resolve);
  });
}

function clone(repo, dir) {
  const commitRef = repo.match(commitRefRe), 
    branch = commitRef && commitRef[0] ? commitRef[0].replace(/^\#/, '') : 'master';
  repo = repo.replace(commitRef, '');
  return sequence([
    run.bind(null, 'rm', '-rf', dir),
    run.bind(null, 'git', 'clone', repo, '-b', branch, '--single-branch', dir)
  ]);
}

function stage(file) {
  if(file) {
    const files = typeof file === 'string' ? file : file.join(' ');
    return run('git', 'add', files).catch(error => {
      log.warn(`Could not stage ${file}`);
    });
  } else {
    return noop;
  }
}

function stageDir(baseDir) {
  baseDir = baseDir || '.';
  return run('git', util.format('add %s --all', baseDir));
}

function status() {
  return run(
    '!git',
    'status --short --untracked-files=no'
  ).then(result => {
    // Output also when not verbose
    !config.isVerbose && log.log(result.output);
  });
}

function commit(path, message, version) {
  return run(
    'git',
    'commit',
    config.isForce ? '--allow-empty' : '',
    `--message="${util.format(message, version)}"`,
    path
  ).catch(err => {
    log.debug(err);
    log.warn('Nothing to commit. The latest commit will be tagged.');
  });
}

function tag(version, tag, annotation) {
  return run(
    'git',
    'tag',
    config.isForce ? '--force' : '',
    '--annotate',
    `--message="${util.format(annotation, version)}"`,
    util.format(tag, version)
  ).then(() => {
    config.setRuntimeOption('tag_set', true);
  }).catch(() => {
    log.warn(`Could not tag. Does tag "${version}" already exist? Use --force to move a tag.`);
  });
}

function getLatestTag() {
  return run('!git', 'describe --tags --abbrev=0').then(result => {
    const latestTag = result && result.output ? result.output.trim() : null;
    return latestTag;
  });
}

function push(remoteUrl, pushUrl) {
  const repository = pushUrl || '';
  return run('git', 'push', repository).catch(err => {
    log.error('Please make sure an upstream remote repository is configured for the current branch. Example commands:\n' +
      `git remote add origin ${remoteUrl}\n` +
      'git push --set-upstream origin master');
    throw new Error(err);
  });
}

function pushTags(version, pushUrl) {
  const repository = pushUrl || '';
  return run(
    'git',
    'push',
    '--follow-tags',
    config.isForce ? '--force' : '',
    repository
  ).catch(() => {
    log.error(`Could not push tag(s). Does tag "${version}" already exist? Use --force to move a tag.`);
  });
}

function initGithubClient(repo) {
  if(!_githubClient) {
    _githubClient = new GitHubApi({
      version: '3.0.0',
      debug: config.isDebug,
      protocol: 'https',
      host: repo.host === 'github.com' ? '' : repo.host,
      pathPrefix: repo.host === 'github.com' ? '' : '/api/v3',
      timeout: 10000,
      headers: {
        'user-agent': 'webpro/release-it'
      }
    });

    _githubClient.authenticate({
      type: 'oauth',
      token: config.getRuntimeOption('github_token')
    });
  }
  return _githubClient;
}

function getGithubToken(tokenRef) {
  const token = process.env[tokenRef];
  config.setRuntimeOption('github_token', token);
  return token;
}

function getChangelog(options) {
  function runChangelogCommand(command) {
    return run(command).then(result => {
      process.stdout.write('\n');
      config.setRuntimeOption('changelog', result.output);
      return options;
    });
  }

  if(options.changelogCommand) {
    if(options.changelogCommand.match(/\[REV_RANGE\]/)) {
      const previousVersion = config.getRuntimeOption('previousVersion');
      const previousTag = util.format(options.src.tagName, previousVersion);
      return tagExists(previousTag).then(hasTag => {
        const command = options.changelogCommand.replace(/\[REV_RANGE\]/, hasTag ? `${previousTag}...HEAD` : '');
        return runChangelogCommand(command);
      }).catch(err => {
        log.warn('Probably the current version in package.json is not a known tag in the repository.');
        throw new Error(`Could not create changelog from latest tag (${previousTag}) to HEAD.`);
      });
    } else {
      return runChangelogCommand(options.changelogCommand);
    }
  } else {
    return noop;
  }
}

function release(options, remoteUrl, tagName) {
  const repo = repoPathParse(remoteUrl);
  const version = config.getRuntimeOption('version');

  log.execution('node-github releases#createRelease', repo.repository);

  const githubClient = initGithubClient(repo),
    attempts = 3;
  var success = false;

  if(!config.isDryRun) {
    return when.iterate(
      attempt => attempt + 1,
      attempt => success || attempt === attempts,
      attempt => when.promise(resolve => {
        githubClient.repos.createRelease({
          owner: repo.owner,
          repo: repo.project,
          tag_name: util.format(tagName, version),
          name: util.format(options.github.releaseName, version),
          body: config.getRuntimeOption('changelog'),
          prerelease: options.github.preRelease
        }, (err, response) => {
          if(err) {
            log[attempt + 1 < attempts ? 'warn' : 'error'](`${err.defaultMessage} (Attempt ${attempt + 1} of ${attempts})`);
            log[attempt + 1 < attempts ? 'warn' : 'error'](err.message);
          } else {
            log.execution('node-github', response.meta.location, response.tag_name, response.name);
            log.verbose(response.body);
            success = true;
          }
          resolve();
        });
      }),
      0
    );
  } else {
    return noop;
  }
}

module.exports = {
  isGitRepo,
  getRemoteUrl,
  status,
  clone,
  stage,
  stageDir,
  commit,
  tag,
  getLatestTag,
  push,
  pushTags,
  getChangelog,
  getGithubToken,
  release,
  isWorkingDirClean,
  hasChanges
};
