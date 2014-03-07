var util = require('./util'),
    shell = require('./shell'),
    log = require('./log'),
    config = require('./config'),
    git = require('./git'),
    enquiry = require('./enquiry'),
    when = require('when'),
    sequence = require('when/sequence'),
    noop = when.resolve.bind(when, true);

function releaseSourceRepo() {

    log.bold('Release source repo');

    var options = config.getOptions(),
        repo = getSrcRepoTasks(options);

    var executeTasks = [
        repo.isRepo,
        repo.bump,
        repo.stage,
        repo.hasChanges,
        repo.build
    ];

    if(options['non-interactive']) {

        executeTasks.push(
            repo.commit,
            repo.tag,
            repo.push,
            repo.pushTags,
            repo.publish
        )

    } else {

        executeTasks.push(enquiry.bind(null, 'src', repo, options));

    }

    return sequence(executeTasks);

}

function releaseDistRepo() {

    var options = config.getOptions(),
        repo = getDistRepoTasks(options);

    if(!options.distRepo) {
        log.verbose('No Git endpoint provided for `distRepo` (distribution repository).');
        return noop();
    }

    log.bold('Release distribution repo');

    var executeTasks = [
        repo.clone,
        repo.copy,
        repo.pushd,
        repo.bump,
        repo.stageAll,
        repo.hasChanges
    ];

    if(options['non-interactive']) {

        executeTasks.push(
            repo.commit,
            repo.tag,
            repo.push,
            repo.pushTags,
            repo.publish
        )

    } else {

        executeTasks.push(enquiry.bind(null, 'dist', repo, options));

    }

    executeTasks.push(repo.popd);

    return sequence(executeTasks);

}

function getGenericTasks(options) {
    return {
        isRepo: git.isGitRepo,
        hasChanges: git.hasChanges,
        build: shell.build.bind(null, options.buildCommand),
        bump: shell.bump.bind(null, options.pkgFiles, options.version),
        status: git.status,
        stageAll: git.stageAll,
        commit: git.commit.bind(null, '.', options.commitMessage, options.version),
        tag: git.tag.bind(null, options.version, options.tagName, options.tagAnnotation),
        push: git.push,
        pushTags: git.pushTags,
        popd: shell.popd
    }
}

function getSrcRepoTasks(options) {

    var isPublish = !(options['non-interactive'] && !options.publish) && !options.distRepo;

    return util.extend({}, getGenericTasks(options), {
        stage: git.stage.bind(null, options.pkgFiles),
        publish: isPublish ? shell.npmPublish : noop
    });
}

function getDistRepoTasks(options) {

    var isPublish = !(options['non-interactive'] && !options.publish) && !!options.distRepo;

    return util.extend({}, getGenericTasks(options), {
        clone: git.clone.bind(null, options.distRepo, options.distStageDir),
        copy: shell.copy.bind(null, options.distFiles, {cwd: options.distBase}, options.distStageDir),
        pushd: shell.pushd.bind(null, options.distStageDir),
        publish: isPublish ? shell.npmPublish : noop
    });
}

module.exports = {
    releaseSrc: releaseSourceRepo,
    releaseDist: releaseDistRepo
};
