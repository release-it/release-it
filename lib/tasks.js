const _ = require('lodash'),
  shell = require('./shell'),
  log = require('./log'),
  git = require('./git'),
  enquiry = require('./enquiry'),
  util = require('./util'),
  config = require('./config'),
  sequence = require('when/sequence'),
  noop = () => Promise.resolve();

function parseVersion() {

  const options = config.options;
  const version = util.isValidVersion(options.increment) ? options.increment : options.npm.version;

  if(!version) {

    return git.getLatestTag().then(tag => {
      if(tag) {
        const nextVersion = util.increment(tag, options.increment, options.prereleaseId);
        log.bold(util.format('Latest tag: %s. Next version: %s', tag, nextVersion));
        config.setRuntimeOption('previousVersion', tag);
        config.setRuntimeOption('version', nextVersion);
      } else {
        throw new Error('Error detecting current version from latest tag.');
      }
    }).catch(err => {
      log.debug(err);
      throw new Error('No version provided. Please provide version argument, or make sure there is a tag to derive it from.');
    });

  } else {
    config.setRuntimeOption('previousVersion', version);
    config.setRuntimeOption('version', util.increment(version, options.increment, options.prereleaseId));
  }
}

function setRemoteGitUrl() {
  return git.getRemoteUrl().then(remoteUrl => {
    config.setRuntimeOption('remoteUrl', remoteUrl);
  });
}

function getChangelog() {
  const options = config.options;
  if(options.github.release) {
    return git.getChangelog(options);
  }
}

function checkGithubToken() {
  const options = config.options;
  if(options.github.release) {
    const token = git.getGithubToken(options.github.tokenRef);
    if(!token) {
      throw new Error(`About to release to GitHub, but ${options.github.tokenRef} environment variable not set`);
    }
  }
}

function releaseSourceRepo() {

  log.bold('Release source repo');

  const options = config.options,
    repo = getSrcRepoTasks(options);

  const executeTasks = [
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
    const distRepoTasks = getDistRepoTasks(options);
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
      repo.release,
      repo.uploadAssets,
      repo.publish
    )

  } else {

    executeTasks.push(enquiry.bind(null, 'src', repo, options));

  }

  executeTasks.push(repo.afterReleaseCommand);

  return sequence(executeTasks);

}

function releaseDistRepo() {

  const options = config.options,
    repo = getDistRepoTasks(options);

  if(!options.dist.repo) {
    log.verbose('No "dist.repo" configuration provided, done.');
    return noop();
  }

  log.bold('Release distribution repo');

  const executeTasks = [
    repo.pushd
  ];

  if(options['non-interactive']) {

    executeTasks.push(
      repo.commit,
      repo.tag,
      repo.push,
      repo.publish
    )

  } else {

    executeTasks.push(enquiry.bind(null, 'dist', repo, options));

  }

  executeTasks.push(repo.afterReleaseCommand);

  executeTasks.push(repo.popd);

  return sequence(executeTasks);

}

function getGenericTasks() {
  const version = config.getRuntimeOption('version');
  return {
    isRepo: git.isGitRepo,
    status: git.status,
    stageDir: git.stageDir,
    push: git.push.bind(null, config.getRuntimeOption('remoteUrl'), null, version),
    popd: shell.popd
  }
}

function getSrcRepoTasks() {

  const options = config.options,
    version = config.getRuntimeOption('version'),
    isMakeBaseDir = options.buildCommand && options.dist.repo && options.dist.baseDir,
    isStageBuildDir = !!options.buildCommand && !options.dist.repo && options.dist.baseDir,
    isPublish = !options['non-interactive'] || (options.npm.publish && !options.dist.repo);

  return _.extend({}, getGenericTasks(options), {
    mkCleanDir: isMakeBaseDir ? shell.mkCleanDir.bind(null, options.dist.baseDir) : noop,
    buildCommand: shell.build.bind(null, options.buildCommand, options),
    beforeStartCommand: options.src.beforeStartCommand ? shell.runTemplateCommand.bind(null, options.src.beforeStartCommand) : noop,
    checkClean: git.isWorkingDirClean.bind(null, options.requireCleanWorkingDir),
    bump: shell.bump.bind(null, options.pkgFiles, version),
    beforeStageCommand: options.src.beforeStageCommand ? shell.runTemplateCommand.bind(null, options.src.beforeStageCommand) : noop,
    stage: git.stage.bind(null, options.pkgFiles),
    stageDir: isStageBuildDir ? git.stageDir.bind(null, options.dist.baseDir) : noop,
    hasChanges: git.hasChanges.bind(null, 'src'),
    commit: git.commit.bind(null, '.', options.src.commitMessage, version),
    tag: git.tag.bind(null, version, options.src.tagName, options.src.tagAnnotation),
    push: git.push.bind(null, config.getRuntimeOption('remoteUrl'), options.src.pushRepo, version),
    release: options.github.release ? git.release.bind(null, options, config.getRuntimeOption('remoteUrl'), options.src.tagName) : noop,
    uploadAssets: options.src.githubAssets ? git.uploadAssets.bind(null, options, config.getRuntimeOption('remoteUrl'), options.src.githubAssets) : noop,
    publish: isPublish ? shell.npmPublish.bind(null, options.npm.publishPath, options.npm.tag) : noop,
    afterReleaseCommand: options.src.afterReleaseCommand ? shell.runTemplateCommand.bind(null, options.src.afterReleaseCommand) : noop
  });
}

function getDistRepoTasks() {

  const options = config.options,
    version = config.getRuntimeOption('version'),
    isPublish = !options['non-interactive'] || (options.npm.publish && !!options.dist.repo),
    distPkgFiles = options.dist.pkgFiles || options.pkgFiles;

  return _.extend({}, getGenericTasks(options), {
    bump: shell.bump.bind(null, distPkgFiles, version),
    beforeStageCommand: options.dist.beforeStageCommand ? shell.runTemplateCommand.bind(null, options.dist.beforeStageCommand) : noop,
    hasChanges: git.hasChanges.bind(null, 'dist'),
    clone: git.clone.bind(null, options.dist.repo, options.dist.stageDir),
    copy: shell.copy.bind(null, options.dist.files, {cwd: options.dist.baseDir}, options.dist.stageDir),
    pushd: shell.pushd.bind(null, options.dist.stageDir),
    commit: git.commit.bind(null, '.', options.dist.commitMessage, version),
    tag: git.tag.bind(null, version, options.dist.tagName, options.dist.tagAnnotation),
    release: options.github.release ? git.release.bind(null, options, options.dist.repo, options.dist.tagName) : noop,
    uploadAssets: options.dist.githubAssets ? git.uploadAssets.bind(null, options, options.dist.repo, options.dist.githubAssets) : noop,
    publish: isPublish ? shell.npmPublish.bind(null, options.npm.publishPath, options.npm.tag) : noop,
    afterReleaseCommand: options.dist.afterReleaseCommand ? shell.runTemplateCommand.bind(null, options.dist.afterReleaseCommand) : noop
  });
}

module.exports = {
  run: function(options) {
    return sequence([
      parseVersion,
      setRemoteGitUrl,
      getChangelog,
      checkGithubToken,
      releaseSourceRepo,
      releaseDistRepo
    ], options)
  }
};
