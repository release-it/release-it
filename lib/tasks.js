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

  const { isInteractive, isVerbose, isDryRun } = config;
  const log = new Logger({ isInteractive, isVerbose, isDryRun });
  const metrics = new Metrics({ isEnabled: config.isCollectMetrics });

  try {
    const options = handleDeprecated(config.getOptions());

    debugConfig('%O', options);

    metrics.trackEvent('start', options);

    const { name, dist, use, pkgFiles, scripts } = options;

    const shell = new Shell({ isVerbose, isDryRun, log, config });
    const gitClient = new Git(options.git, { log, shell });
    const gitDistClient = new Git(options.git, { log, shell });
    const s = new Spinner({ isInteractive, isVerbose, isDryRun });
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

    await s.show(scripts.beforeStart, () => run(scripts.beforeStart), scripts.beforeStart);

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
        log.info();
      });
    }

    v.validate();
    config.setRuntimeOptions(v.details);
    const { version, isPreRelease } = v.details;

    if (isInteractive && pkgFiles && options.git.requireCleanWorkingDir) {
      process.on('SIGINT', () => gitClient.reset(pkgFiles));
      process.on('exit', () => gitClient.reset(pkgFiles));
    }

    await s.show(scripts.beforeBump, () => run(scripts.beforeBump), scripts.beforeBump);
    await s.show(true, () => shell.bump(pkgFiles, version), 'Bump version');
    await s.show(scripts.afterBump, () => run(scripts.afterBump), scripts.afterBump);

    if (isLateChangeLog) {
      changelog = await getChangelog();
      config.setRuntimeOptions({ changelog });
    }

    await s.show(scripts.beforeStage, () => run(scripts.beforeStage), scripts.beforeStage);
    await gitClient.stage(pkgFiles);
    await gitClient.stageDir();

    if (options.dist.repo) {
      const { pkgFiles, scripts } = options.dist;
      await s.show(true, () => gitDistClient.clone(options.dist.repo, options.dist.stageDir), 'Clone');
      await shell.copy(options.dist.files, options.dist.stageDir, { cwd: options.dist.baseDir });
      await shell.pushd(options.dist.stageDir);
      await shell.bump(pkgFiles, version);
      await s.show(scripts.beforeStage, () => run(scripts.beforeStage), scripts.beforeStage);
      await gitDistClient.stageDir();
      await shell.popd();
    }

    const release = async ({ gitClient, ghClient, npmClient }) => {
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
      changeSet ? log.info(`Changeset:${EOL}${truncateLines(changeSet)}${EOL}`) : log.warn(`Empty changeset${EOL}`);

      if (!isInteractive) {
        await s.show(git.commit, commit, 'Git commit');
        await s.show(git.tag, tag, 'Git tag');
        await s.show(git.push, push, 'Git push');
        await s.show(github.release, release, 'GitHub release');
        await s.show(github.assets, uploadAssets, 'GitHub upload assets');
        await s.show(npm.publish && !npm.private, publish, 'npm publish');
      } else {
        await prompt(git.commit, context, 'commit', commit);
        await prompt(git.tag, context, 'tag', tag);
        await prompt(git.push, context, 'push', push);
        await prompt(github.release, context, 'release', releaseAndUploadAssets);
        await prompt(npm.publish && !npm.private, context, 'publish', publish);
      }

      await s.show(scripts.afterRelease, () => run(scripts.afterRelease), scripts.afterRelease);

      ghClient.isReleased && log.log(`🔗 ${ghClient.getReleaseUrl()}`);
      npmClient.isPublished && log.log(`🔗 ${npmClient.getPackageUrl()}`);
    };

    await release({ gitClient, ghClient, npmClient });

    if (options.dist.repo) {
      log.log(`${EOL}🚀 Let's release the distribution repo for ${name}${EOL}`);

      await shell.pushd(options.dist.stageDir);

      await gitDistClient.init();
      gitDistClient.handleTagOptions(gitClient);

      await release({ gitClient: gitDistClient, ghClient: ghDistClient, npmClient: npmDistClient });

      await shell.popd();
      await run(`!rm -rf ${options.dist.stageDir}`);
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
