const { EOL } = require('os');
const Logger = require('./log');
const Config = require('./config');
const Shell = require('./shell');
const Git = require('./git');
const GitHub = require('./github-client');
const npm = require('./npm');
const Version = require('./version');
const prompt = require('./prompt');
const Spinner = require('./spinner');
const Metrics = require('./metrics');
const { truncateLines } = require('./util');
const { debug, debugConfig } = require('./debug');
const handleDeprecated = require('./deprecated');

module.exports = async opts => {
  const config = new Config(opts);

  const { isInteractive, isVerbose, isDryRun, isDebug } = config;
  const log = new Logger({ isInteractive, isVerbose, isDryRun });
  const metrics = new Metrics({ isEnabled: config.isCollectMetrics });
  const s = new Spinner({ isInteractive, isVerbose, isDryRun, isDebug });

  try {
    const options = handleDeprecated(config.getOptions());

    debugConfig('%O', options);

    metrics.trackEvent('start', options);

    const { name, dist, use, pkgFiles, scripts } = options;
    const { beforeStart, beforeBump, afterBump, beforeStage } = scripts;

    const shell = new Shell({ isVerbose, isDryRun, log, config });
    const gitClient = new Git(options.git, { log, shell });
    const gitDistClient = new Git(options.git, dist.git, { log, shell });
    let changelog;

    await gitClient.init();
    await gitClient.validate();
    const { latestTag, isRootDir } = gitClient;

    // TODO: fix up stage dir validation for dist repo
    gitDistClient.validateStageDir(dist.stageDir);

    const remoteUrl = gitClient.remoteUrl;
    const run = shell.runTemplateCommand.bind(shell);

    const ghClient = new GitHub(options.github, options.git, { isDryRun, log, remoteUrl });
    const ghDistClient = new GitHub(options.github, dist.github, options.git, dist.git, { isDryRun, log, remoteUrl });

    const npmClient = new npm(options.npm, { isDryRun, shell, log });
    const npmDistClient = new npm(options.npm, dist.npm, { isDryRun, shell, log });

    ghClient.validate();
    ghDistClient.validate();

    const getChangelog = async () => {
      const changelog = await gitClient.getChangelog(scripts.changelog);
      changelog ? log.info(`Changelog:${EOL}${truncateLines(changelog)}${EOL}`) : log.warn(`Empty changelog${EOL}`);
      return changelog;
    };

    await s.show({ enabled: beforeStart, task: () => run(beforeStart), label: beforeStart, forced: true });

    const v = new Version({ preReleaseId: options.preReleaseId, log });
    v.setLatestVersion({ use, gitTag: latestTag, pkgVersion: options.npm.version, isRootDir });
    await v.bump({ increment: options.increment, preRelease: options.preRelease });

    config.setRuntimeOptions(v.details);
    const { latestVersion } = v;

    const suffix = v.version ? `${latestVersion}...${v.version}` : `currently at ${latestVersion}`;
    log.log(`${EOL}🚀 Let's release ${name} (${suffix})${EOL}`);

    // TODO: don't use class-in-class
    const isLateChangeLog = v.recs.isRecommendation(options.increment);
    if (!isLateChangeLog) {
      changelog = await getChangelog();
      config.setRuntimeOptions({ changelog });
    }

    if (isInteractive && !v.version) {
      const context = config.getOptions();
      await prompt(true, context, 'incrementList', async increment => {
        if (increment) {
          await v.bump({ increment });
        } else {
          await prompt(true, context, 'version', async version => {
            v.version = version;
          });
        }
      });
    }

    v.validate();
    config.setRuntimeOptions(v.details);
    const { version, isPreRelease } = v.details;

    if (isInteractive && pkgFiles && options.git.requireCleanWorkingDir) {
      process.on('SIGINT', () => gitClient.reset(pkgFiles));
      process.on('exit', () => gitClient.reset(pkgFiles));
    }

    await s.show({ enabled: beforeBump, task: () => run(beforeBump), label: beforeBump, forced: true });
    await s.show({ task: () => shell.bump(pkgFiles, version), label: 'Bump version' });
    await s.show({ enabled: afterBump, task: () => run(afterBump), label: afterBump, forced: true });

    if (isLateChangeLog) {
      changelog = await getChangelog();
      config.setRuntimeOptions({ changelog });
    }

    await s.show({ enabled: beforeStage, task: () => run(beforeStage), label: beforeStage, forced: true });
    await gitClient.stage(pkgFiles);
    await gitClient.stageDir();

    if (options.dist.repo) {
      const { scripts, repo, stageDir, files, baseDir, pkgFiles } = options.dist;
      const { beforeStage } = scripts;
      await s.show({ task: () => gitDistClient.clone(repo, stageDir), label: 'Clone' });
      await shell.copy(files, stageDir, { cwd: baseDir });
      await shell.pushd(stageDir);
      await shell.bump(pkgFiles, version);
      await s.show({ enabled: beforeStage, task: () => run(beforeStage), label: beforeStage, forced: true });
      await gitDistClient.stageDir();
      await shell.popd();
    }

    const release = async ({ gitClient, ghClient, npmClient, scripts }) => {
      const { afterRelease } = scripts;
      const git = gitClient.options;
      const github = ghClient.options;
      const npm = npmClient.options;
      const context = Object.assign(config.getOptions(), { git, github, npm });

      const commit = () => gitClient.commit();
      const tag = () => gitClient.tag();
      const push = () => gitClient.push();
      const release = () => ghClient.release({ version, isPreRelease, changelog });
      const uploadAssets = () => ghClient.uploadAssets();
      const releaseAndUploadAssets = async () => (await release()) && (await uploadAssets());
      const otpPrompt = isInteractive && (task => prompt(true, context, 'otp', task));
      const publish = () => npmClient.publish({ version, isPreRelease, otpPrompt });

      const changeSet = await gitClient.status();
      if (changeSet) {
        log.info(`${EOL}Changeset:${EOL}${truncateLines(changeSet)}${EOL}`);
      } else {
        log.warn(`Empty changeset${EOL}`);
      }

      if (!isInteractive) {
        await s.show({ enabled: git.commit, task: commit, label: 'Git commit' });
        await s.show({ enabled: git.tag, task: tag, label: 'Git tag' });
        await s.show({ enabled: git.push, task: push, label: 'Git push' });
        await s.show({ enabled: github.release, task: release, label: 'GitHub release' });
        await s.show({ enabled: github.assets, task: uploadAssets, label: 'GitHub upload assets' });
        await s.show({ enabled: npm.publish && !npm.private, task: publish, label: 'npm publish' });
      } else {
        await prompt(git.commit, context, 'commit', commit);
        await prompt(git.tag, context, 'tag', tag);
        await prompt(git.push, context, 'push', push);
        await prompt(github.release, context, 'release', releaseAndUploadAssets);
        await prompt(npm.publish && !npm.private, context, 'publish', publish);
      }

      await s.show({ enabled: afterRelease, task: () => run(afterRelease), label: afterRelease, forced: true });

      ghClient.isReleased && log.log(`🔗 ${ghClient.getReleaseUrl()}`);
      npmClient.isPublished && log.log(`🔗 ${npmClient.getPackageUrl()}`);
    };

    await release({ gitClient, ghClient, npmClient, scripts });

    if (options.dist.repo) {
      const { stageDir, scripts } = options.dist;

      log.log(`${EOL}🚀 Let's release the distribution repo for ${name}`);

      await shell.pushd(stageDir);

      await gitDistClient.init();
      gitDistClient.handleTagOptions(gitClient);

      await release({ gitClient: gitDistClient, ghClient: ghDistClient, npmClient: npmDistClient, scripts });
      await shell.popd();
      await run(`!rm -rf ${stageDir}`);
    }

    await metrics.trackEvent('end');

    log.log(`🏁 Done (in ${Math.floor(process.uptime())}s.)`);

    return Promise.resolve({
      name,
      changelog,
      latestVersion,
      version
    });
  } catch (err) {
    await metrics.trackException(err);
    log.error(err.message || err);
    debug(err);
    throw err;
  }
};
