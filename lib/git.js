var util = require('./util'),
    run = require('./shell').run,
    config = require('./config'),
    when = require('when'),
    sequence = require('when/sequence'),
    GitHubApi = require('github'),
    repoPathParse = require('repo-path-parse'),
    log = require('./log'),
    tracker = require('./tracker');

var commitRefRe = /#.+$/,
    _githubClient = null;

function isGitRepo() {
    return run('git', 'rev-parse --git-dir');
}

function getRemoteUrl() {
    return run('git', 'config --get remote.origin.url').then(function(result) {
        if(result && result.output) {
            return result.output.trim();
        }
        throw new Error('Unable to get remote Git url.');
    });
}

function hasChanges() {
    // Inverted: reject if run promise is resolved (i.e. `git diff-index` returns exit code 0)
    return when.promise(function(resolve, reject) {
        run('git', 'diff-index --name-only HEAD --exit-code').then(function() {
            if(!config.isDryRun()) {
                log.warn('No changes to release.');
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
    ])
}

function stage(file) {
    var files = typeof file === 'string' ? file : file.join(' ');
    return run('git', 'add', files).catch(function(error) {
        log.warn('There was a problem staging ' + file);
    })
}

function stageAll() {
    return run('git', 'add . --all');
}

function status() {
    tracker._track('git', 'status');
    return run(
        'git',
        'status --short --untracked-files=no'
    ).then(function(result) {
        // Output also when not verbose
        !config.isVerbose() && log.log(result.output);
    });
}

function commit(path, message, version) {
    tracker._track('git', 'commit');
    return run(
        'git',
        'commit',
        config.isForce() ? '--allow-empty' : '',
        '--message="' + util.format(message, version) + '"',
        path
    ).catch(function(err) {
        log.debug(err);
        log.warn('Nothing to commit. The last commit will be tagged.');
    })
}

function tag(version, tag, annotation) {
    tracker._track('git', 'tag');
    return run(
        'git',
        'tag',
        config.isForce() ? '--force' : '',
        '--annotate',
        '--message="' + util.format(annotation, version) + '"',
        util.format(tag, version)
    ).catch(function() {
        throw new Error('Unable to tag. Does tag "' + version + '" already exist? Use --force to move a tag.');
    });
}

function getLatestTag() {
    return run('git', 'describe --tags --abbrev=0').then(function(result) {
        return result && result.output ? result.output.trim() : null;
    });
}

function push(repository) {
    tracker._track('git', 'push');
    return run('git', 'push').catch(function(err) {
        log.error('Please make sure an upstream remote repository is configured for the current branch. Example commands:\n' +
            'git remote add origin ' + repository + '\n' +
            'git push --set-upstream origin master');
        throw new Error(err);
    })
}

function pushTags() {
    tracker._track('git', 'push-tags');
    return run(
        'git',
        'push',
        '--tags',
        config.isForce() ? '--force' : ''
    );
}

function initGithubClient(token) {
    if(!_githubClient) {
        _githubClient = new GitHubApi({
            version: '3.0.0',
            debug: config.isDebug(),
            protocol: 'https',
            host: 'api.github.com',
            timeout: 5000,
            headers: {
                'user-agent': 'webpro/release-it'
            }
        });

        _githubClient.authenticate({
            type: 'oauth',
            token: token
        });
    }
    return _githubClient;
}

function getGithubToken(tokenRef) {
    return process.env[tokenRef]
}

function release(options) {
    tracker._track('git', 'release');

    var repo = repoPathParse(options.remoteUrl),
        body;

    if(options.github.releaseBodyCommand) {
        body = getLatestTag().then(function(latestTag) {
            var command = options.github.releaseBodyCommand.replace(/\[REV_RANGE\]/, latestTag + '...' + util.format(options.tagName, options.version) + '^1');
            return run(command);
        });
    } else {
        body = when.resolve({result: ''})
    }

    return body.then(function(result) {

        var githubClient = initGithubClient(options.github.token),
            success = false,
            attempts = 3;

        return when.iterate(function(attempt) {
            return attempt + 1;
        }, function(attempt) {
            return success || attempt === attempts;
        }, function(attempt) {
            return when.promise(function(resolve) {
                githubClient.releases.createRelease({
                    owner: repo.owner,
                    repo: repo.repo,
                    tag_name: util.format(options.tagName, options.version),
                    name: util.format(options.github.releaseName, options.version),
                    body: result.output
                }, function(err, result) {
                    if(err) {
                        log.warn(err.message + ' (Attempt ' + attempt + ' of ' + attempts);
                    } else {
                        log.execution('node-github', result.meta.location, result.tag_name, result.name);
                        success = true;
                    }
                    resolve();
                });
            });
        }, 0);
    });
}

module.exports = {
    isGitRepo: isGitRepo,
    getRemoteUrl: getRemoteUrl,
    status: status,
    clone: clone,
    stage: stage,
    stageAll: stageAll,
    commit: commit,
    tag: tag,
    getLatestTag: getLatestTag,
    push: push,
    pushTags: pushTags,
    getGithubToken: getGithubToken,
    release: release,
    hasChanges: hasChanges
};
