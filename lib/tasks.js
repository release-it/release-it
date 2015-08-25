var _ = require('lodash'),
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

    if(options.dist.repo) {
        // Before committing to src repo, do some potentially problematic dist repo tasks.
        var distRepoTasks = getDistRepoTasks(options);
        executeTasks.push(distRepoTasks.clone);
        executeTasks.push(distRepoTasks.copy);
    }

    if(options['non-interactive']) {

        executeTasks.push(
            repo.commit,
            repo.tag,
            repo.push,
            repo.pushTags,
            repo.release,
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

    if(!options.dist.repo) {
        log.verbose('No distRepo provided, done.');
        return noop();
    }

    log.bold('Release distribution repo');

    var executeTasks = [
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
        build: shell.build.bind(null, options.buildCommand, options.dist.baseDir),
        status: git.status,
        stageAll: git.stageAll,
        commit: git.commit.bind(null, '.', options.commitMessage, options.version),
        tag: git.tag.bind(null, options.version, options.tagName, options.tagAnnotation),
        push: git.push.bind(null, options.repository),
        pushTags: git.pushTags,
        popd: shell.popd
    }
}

function getSrcRepoTasks(options) {

    var isPublish = !(options['non-interactive'] && !options.publish) && !options.dist.repo;

    return _.extend({}, getGenericTasks(options), {
        bump: shell.bump.bind(null, options.pkgFiles, options.version),
        stage: git.stage.bind(null, options.pkgFiles),
        release: options.github.release ? git.release.bind(null, options) : noop,
        publish: isPublish ? shell.npmPublish : noop
    });
}

function getDistRepoTasks(options) {

    var isPublish = !(options['non-interactive'] && !options.publish) && !!options.dist.repo,
        distPkgFiles = options.dist.pkgFiles || options.pkgFiles;

    return _.extend({}, getGenericTasks(options), {
        bump: shell.bump.bind(null, distPkgFiles, options.version),
        clone: git.clone.bind(null, options.dist.repo, options.dist.stageDir),
        copy: shell.copy.bind(null, options.dist.files, {cwd: options.dist.baseDir}, options.dist.stageDir),
        pushd: shell.pushd.bind(null, options.dist.stageDir),
        release: options.github.release ? git.release.bind(null, options) : noop,
        publish: isPublish ? shell.npmPublish : noop
    });
}

module.exports = {
    releaseSrc: releaseSourceRepo,
    releaseDist: releaseDistRepo
};
