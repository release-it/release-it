var _ = require('lodash'),
    shell = require('./shell'),
    log = require('./log'),
    git = require('./git'),
    enquiry = require('./enquiry'),
    when = require('when'),
    util = require('./util'),
    sequence = require('when/sequence'),
    noop = when.resolve.bind(when, true);

function parseVersion(options) {

    var version = util.isValidVersion(options.increment) ? options.increment : options.npm.version;

    if(!version) {

        return git.getLatestTag().then(function(tag) {
            if(tag) {
                var nextVersion = util.increment(tag, options.increment, options.prereleaseId);
                log.bold(util.format('Latest tag: %s. Next version: %s', tag, nextVersion));
                options.version = nextVersion;
                return options;
            } else {
                throw new Error('Error detecting current version from latest tag.');
            }
        }).catch(function(err) {
            console.log(err);
            throw new Error('No version provided. Please provide version argument, or make sure there is a tag to derive it from.');
        });

    } else {
        options.prevVersion = version;
        options.version = util.increment(version, options.increment, options.prereleaseId);
        return options;
    }
}

function getRemoteGitUrl(options) {
    return git.getRemoteUrl().then(function(remoteUrl) {
        options.remoteUrl = remoteUrl;
        return options;
    }).catch(function(err) {
        throw new Error('Unable to get remote Git url.')
    });
}

function getChangelog(options) {
    if(options.github.release) {
        return git.getChangelog(options);
    } else {
        return options;
    }
}

function checkGithubToken(options) {
    if(options.github.release) {
        var token = git.getGithubToken(options.github.tokenRef);
        if(!token) {
            throw new Error('About to release to GitHub, but ' + options.github.tokenRef + ' environment variable not set');
        }
    }
    return options;
}

function releaseSourceRepo(options) {

    log.bold('Release source repo');

    var repo = getSrcRepoTasks(options);

    var executeTasks = [
        repo.beforeStartCommand,
        repo.isRepo,
        repo.checkClean,
        repo.bump,
        repo.mkCleanDir,
        repo.beforeStageCommand,
        repo.buildCommand,
        repo.stage,
        repo.stageDir,
        repo.hasChanges
    ];

    if(options.dist.repo) {
        // Before committing to src repo, do some potentially problematic dist repo tasks.
        var distRepoTasks = getDistRepoTasks(options);
        executeTasks.push(distRepoTasks.clone);
        executeTasks.push(distRepoTasks.copy);
        executeTasks.push(distRepoTasks.pushd);
        executeTasks.push(distRepoTasks.bump);
        executeTasks.push(distRepoTasks.beforeStageCommand);
        executeTasks.push(distRepoTasks.stageDir);
        executeTasks.push(distRepoTasks.hasChanges);
        executeTasks.push(distRepoTasks.popd);
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

    executeTasks.push(repo.afterReleaseCommand);

    return sequence(executeTasks);

}

function releaseDistRepo(options) {

    var repo = getDistRepoTasks(options);

    if(!options.dist.repo) {
        log.verbose('No distRepo provided, done.');
        return noop();
    }

    log.bold('Release distribution repo');

    var executeTasks = [
        repo.pushd
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

    executeTasks.push(repo.afterReleaseCommand);

    executeTasks.push(repo.popd);

    return sequence(executeTasks);

}

function getGenericTasks(options) {
    return {
        isRepo: git.isGitRepo,
        status: git.status,
        stageDir: git.stageDir,
        commit: git.commit.bind(null, '.', options.commitMessage, options.version),
        tag: git.tag.bind(null, options.version, options.tagName, options.tagAnnotation),
        push: git.push.bind(null, options.remoteUrl),
        pushTags: git.pushTags.bind(null, options.version),
        popd: shell.popd
    }
}

function getSrcRepoTasks(options) {

    var isMakeBaseDir = options.buildCommand && options.dist.repo && options.dist.baseDir,
        isStageBuildDir = !!options.buildCommand && !options.dist.repo && options.dist.baseDir,
        isPublish = !options['non-interactive'] || (options.npm.publish && !options.dist.repo);

    return _.extend({}, getGenericTasks(options), {
        mkCleanDir: isMakeBaseDir ? shell.mkCleanDir.bind(null, options.dist.baseDir) : noop,
        buildCommand: shell.build.bind(null, options.buildCommand),
        beforeStartCommand: options.src.beforeStartCommand ? shell.run.bind(null, options.src.beforeStartCommand) : noop,
        checkClean: git.isWorkingDirClean.bind(null, options.requireCleanWorkingDir),
        bump: shell.bump.bind(null, options.pkgFiles, options.version),
        beforeStageCommand: options.src.beforeStageCommand ? shell.run.bind(null, options.src.beforeStageCommand) : noop,
        stage: git.stage.bind(null, options.pkgFiles),
        stageDir: isStageBuildDir ? git.stageDir.bind(null, options.dist.baseDir) : noop,
        hasChanges: git.hasChanges.bind(null, 'src'),
        push: git.push.bind(null, options.remoteUrl, options.src.pushRepo),
        pushTags: git.pushTags.bind(null, options.version, options.src.pushRepo),
        release: options.github.release ? git.release.bind(null, options, options.remoteUrl) : noop,
        publish: isPublish ? shell.npmPublish.bind(null, options.npm.publishPath, options.npm.tag) : noop,
        afterReleaseCommand: options.src.afterReleaseCommand ? shell.run.bind(null, options.src.afterReleaseCommand) : noop
    });
}

function getDistRepoTasks(options) {

    var isPublish = !options['non-interactive'] || (options.npm.publish && !!options.dist.repo),
        distPkgFiles = options.dist.pkgFiles || options.pkgFiles;

    return _.extend({}, getGenericTasks(options), {
        bump: shell.bump.bind(null, distPkgFiles, options.version),
        beforeStageCommand: options.dist.beforeStageCommand ? shell.run.bind(null, options.dist.beforeStageCommand) : noop,
        hasChanges: git.hasChanges.bind(null, 'dist'),
        clone: git.clone.bind(null, options.dist.repo, options.dist.stageDir),
        copy: shell.copy.bind(null, options.dist.files, {cwd: options.dist.baseDir}, options.dist.stageDir),
        pushd: shell.pushd.bind(null, options.dist.stageDir),
        release: options.github.release ? git.release.bind(null, options, options.dist.repo) : noop,
        publish: isPublish ? shell.npmPublish.bind(null, options.npm.publishPath, options.npm.tag) : noop,
        afterReleaseCommand: options.dist.afterReleaseCommand ? shell.run.bind(null, options.dist.afterReleaseCommand) : noop
    });
}

module.exports = {
    run: function(options) {
        return sequence([
            parseVersion,
            getRemoteGitUrl,
            getChangelog,
            checkGithubToken,
            releaseSourceRepo,
            releaseDistRepo
        ], options)
    }
};
