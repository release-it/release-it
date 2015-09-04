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
                var nextVersion = util.increment(tag, options.increment);
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
        options.version = util.increment(version, options.increment);
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
        repo.isRepo,
        repo.bump,
        repo.build,
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

    executeTasks.push(repo.popd);

    return sequence(executeTasks);

}

function getGenericTasks(options) {
    return {
        isRepo: git.isGitRepo,
        build: shell.build.bind(null, options.buildCommand, options.dist.baseDir),
        status: git.status,
        stageDir: git.stageDir,
        commit: git.commit.bind(null, '.', options.commitMessage, options.version),
        tag: git.tag.bind(null, options.version, options.tagName, options.tagAnnotation),
        push: git.push.bind(null, options.remoteUrl),
        pushTags: git.pushTags,
        popd: shell.popd
    }
}

function getSrcRepoTasks(options) {

    var isStageBuildDir = !!options.buildCommand && !options.dist.repo,
        isPublish = !(options['non-interactive'] && !options.publish) && !options.dist.repo;

    return _.extend({}, getGenericTasks(options), {
        bump: shell.bump.bind(null, options.pkgFiles, options.version),
        stage: git.stage.bind(null, options.pkgFiles),
        stageDir: isStageBuildDir ? git.stageDir.bind(null, options.dist.baseDir) : noop,
        hasChanges: git.hasChanges.bind(null, 'source'),
        release: options.github.release ? git.release.bind(null, options, options.remoteUrl) : noop,
        publish: isPublish ? shell.npmPublish : noop
    });
}

function getDistRepoTasks(options) {

    var isPublish = !(options['non-interactive'] && !options.publish) && !!options.dist.repo,
        distPkgFiles = options.dist.pkgFiles || options.pkgFiles;

    return _.extend({}, getGenericTasks(options), {
        bump: shell.bump.bind(null, distPkgFiles, options.version),
        hasChanges: git.hasChanges.bind(null, 'dist'),
        clone: git.clone.bind(null, options.dist.repo, options.dist.stageDir),
        copy: shell.copy.bind(null, options.dist.files, {cwd: options.dist.baseDir}, options.dist.stageDir),
        pushd: shell.pushd.bind(null, options.dist.stageDir),
        release: options.github.release ? git.release.bind(null, options, options.dist.repo) : noop,
        publish: isPublish ? shell.npmPublish : noop
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
