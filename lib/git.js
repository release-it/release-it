var util = require('./util'),
    run = require('./shell').run,
    config = require('./config'),
    when = require('when'),
    sequence = require('when/sequence'),
    GitHubApi = require('github'),
    repoPathParse = require('parse-repo'),
    log = require('./log');

var noop = when.resolve(true),
    commitRefRe = /#.+$/,
    _githubClient = null;

function isGitRepo() {
    return run('!git', 'rev-parse --git-dir');
}

function tagExists(tag) {
    return run('!git', 'show-ref --tags --quiet --verify -- "refs/tags/' + tag + '"').then(function() {
        return true;
    }, function() {
        return false;
    });
}

function getRemoteUrl() {
    return run('!git', 'config --get remote.origin.url').then(function(result) {
        if(result && result.output) {
            return result.output.trim();
        }
        throw new Error('Could not get remote Git url.');
    });
}

function isWorkingDirClean(requireCleanWorkingDir) {
    return requireCleanWorkingDir ? run('!git', 'diff-index --name-only HEAD --exit-code').catch(function() {
        throw new Error('Working dir must be clean.');
    }) : noop;
}

function hasChanges(repo) {
    // Inverted: reject if run promise is resolved (i.e. `git diff-index` returns exit code 0)
    return when.promise(function(resolve) {
        run('!git', 'diff-index --name-only HEAD --exit-code').then(function() {
            if(!config.isDryRun()) {
                config.process.set(repo + '_has_changes', false);
                log.warn('Nothing to commit in ' + repo + ' repo. The latest commit will be tagged.');
            }
            resolve();
        }).catch(resolve);
    });
}

function clone(repo, dir) {
    var commitRef = repo.match(commitRefRe),
        branch = commitRef && commitRef[0] ? commitRef[0].replace(/^\#/, '') : 'master';
    repo = repo.replace(commitRef, '');
    return sequence([
        run.bind(null, 'rm', '-rf', dir),
        run.bind(null, 'git', 'clone', repo, '-b', branch, '--single-branch', dir)
    ]);
}

function stage(file) {
    if(file) {
        var files = typeof file === 'string' ? file : file.join(' ');
        return run('git', 'add', files).catch(function(error) {
            log.warn('Could not stage ' + file);
        })
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
    ).then(function(result) {
        // Output also when not verbose
        !config.isVerbose() && log.log(result.output);
    });
}

function commit(path, message, version) {
    return run(
        'git',
        'commit',
        config.isForce() ? '--allow-empty' : '',
        '--message="' + util.format(message, version) + '"',
        path
    ).catch(function(err) {
        log.debug(err);
        log.warn('Nothing to commit. The latest commit will be tagged.');
    })
}

function tag(version, tag, annotation) {
    return run(
        'git',
        'tag',
        config.isForce() ? '--force' : '',
        '--annotate',
        '--message="' + util.format(annotation, version) + '"',
        util.format(tag, version)
    ).then(function() {
        config.process.set('tag_set', true);
    }).catch(function() {
        log.warn('Could not tag. Does tag "' + version + '" already exist? Use --force to move a tag.');
    });
}

function getLatestTag() {
    return run('!git', 'describe --tags --abbrev=0').then(function(result) {
        var latestTag = result && result.output ? result.output.trim() : null;
        config.process.set('prevVersion', latestTag);
        return latestTag;
    });
}

function push(remoteUrl, pushUrl) {
    var repository = pushUrl || '';
    return run('git', 'push', repository).catch(function(err) {
        log.error('Please make sure an upstream remote repository is configured for the current branch. Example commands:\n' +
            'git remote add origin ' + remoteUrl + '\n' +
            'git push --set-upstream origin master');
        throw new Error(err);
    })
}

function pushTags(version, pushUrl) {
    var repository = pushUrl || '';
    return run(
        'git',
        'push',
        '--follow-tags',
        config.isForce() ? '--force' : '',
        repository
    ).catch(function() {
        log.error('Could not push tag(s). Does tag "' + version + '" already exist? Use --force to move a tag.');
    });
}

function initGithubClient(repo) {
    if(!_githubClient) {
        _githubClient = new GitHubApi({
            version: '3.0.0',
            debug: config.isDebug(),
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
            token: config.process.get('github_token')
        });
    }
    return _githubClient;
}

function getGithubToken(tokenRef) {
    var token = process.env[tokenRef];
    config.process.set('github_token', token);
    return token;
}

function getChangelog(options) {
  function runChangelogCommand (command) {
    return run(command).then(function(result) {
        process.stdout.write('\n');
        config.process.set('changelog', result.output);
        return options;
    })
  }

  if(options.changelogCommand) {
    if(options.changelogCommand.match(/\[REV_RANGE\]/)) {
      var prevVersion = config.process.get('prevVersion') || options.prevVersion;
      var prevTag = util.format(options.tagName, prevVersion);
      return tagExists(prevTag).then(function(hasTag) {
          var command = options.changelogCommand.replace(/\[REV_RANGE\]/, hasTag ? prevTag + '...HEAD' : '');
          return runChangelogCommand(command);
      }).catch(function(err) {
          log.warn('Probably the current version in package.json is not a known tag in the repository.');
          throw new Error('Could not create changelog from latest tag (' + prevTag + ') to HEAD.');
      })
    } else {
      return runChangelogCommand(options.changelogCommand);
    }
  } else {
    return noop;
  }
}

function release(options, remoteUrl) {

    var repo = repoPathParse(remoteUrl);

    log.execution('node-github releases#createRelease', repo.repository);

    var githubClient = initGithubClient(repo),
        success = false,
        attempts = 3;

    if(!config.isDryRun()) {
        return when.iterate(function(attempt) {
            return attempt + 1;
        }, function(attempt) {
            return success || attempt === attempts;
        }, function(attempt) {
            return when.promise(function(resolve) {
                githubClient.repos.createRelease({
                    owner: repo.owner,
                    repo: repo.project,
                    tag_name: util.format(options.tagName, options.version),
                    name: util.format(options.github.releaseName, options.version),
                    body: config.process.get('changelog')
                }, function(err, response) {
                    if(err) {
                        log[attempt + 1 < attempts ? 'warn' : 'error'](err.defaultMessage + ' (Attempt ' + (attempt + 1) + ' of ' + attempts + ')');
                        log[attempt + 1 < attempts ? 'warn' : 'error'](err.message);
                    } else {
                        log.execution('node-github', response.meta.location, response.tag_name, response.name);
                        log.verbose(response.body);
                        success = true;
                    }
                    resolve();
                });
            });
        }, 0);
    } else {
        return noop;
    }
}

module.exports = {
    isGitRepo: isGitRepo,
    getRemoteUrl: getRemoteUrl,
    status: status,
    clone: clone,
    stage: stage,
    stageDir: stageDir,
    commit: commit,
    tag: tag,
    getLatestTag: getLatestTag,
    push: push,
    pushTags: pushTags,
    getChangelog: getChangelog,
    getGithubToken: getGithubToken,
    release: release,
    isWorkingDirClean: isWorkingDirClean,
    hasChanges: hasChanges
};
