var util = require('util'),
    run = require('./shell').run,
    config = require('./config'),
    when = require('when'),
    sequence = require('when/sequence'),
    log = require('./log');

function isGitRepo() {
    return run('git', 'rev-parse --git-dir');
}

function hasChanges() {
    // Inverted: reject if run promise is resolved (i.e. `git diff-index` returns exit code 0)
    return when.promise(function(resolve, reject) {
        return run(
            'git',
            'diff-index --name-only HEAD --exit-code'
        ).then(config.isForce() || config.isDryRun() ? resolve : reject, resolve);
    }).catch(function() {
        throw new Error('No changes to release. Use --force to override.');
    });
}

function clone(repo, dir) {
    return sequence([
        run.bind(null, 'rm', '-rf', dir),
        run.bind(null, 'git', 'clone', repo, dir)
    ])
}

function stage(file) {
    var files = typeof file === 'string' ? file : file.join(' ');
    return run('git', 'add', files);
}

function stageAll() {
    return run('git', 'add . --all');
}

function status() {
    return run(
        'git',
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
    )
}

function tag(version, tag, annotation) {
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

function push() {
    return run('git', 'push');
}

function pushTags() {
    return run(
        'git',
        'push',
        '--tags',
        config.isForce() ? '--force' : ''
    );
}

module.exports = {
    isGitRepo: isGitRepo,
    status: status,
    clone: clone,
    stage: stage,
    stageAll: stageAll,
    commit: commit,
    tag: tag,
    push: push,
    pushTags: pushTags,
    hasChanges: hasChanges
};
