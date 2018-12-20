const { EOL } = require('os');
const repoPathParse = require('parse-repo');
const _ = require('lodash');
const { bump, runTemplateCommand: run, pushd, copy, popd, isSubDir } = require('./shell');
const npmClient = require('./npm');
const Git = require('./git');
const githubClient = require('./github-client');
const semver = require('semver');
const prompt = require('./prompt');
const { format, truncateLines } = require('./util');
const { parse: parseVersion } = require('./version');
const { getIsLateChangeLog } = require('./recommendations');
const { config } = require('./config');
const { log, info, warn, logError } = require('./log');
const { debug, debugConfig } = require('./debug');
const { spinner } = require('./spinner');
const handleDeprecated = require('./deprecated');
const {
  GitRepoError,
  GitRemoteUrlError,
  GitCleanWorkingDirError,
  GitUpstreamError,
  GithubTokenError,
  DistRepoStageDirError,
  InvalidVersionError
} = require('./errors');

const validateRepoState = async options => {
  const { github, git, dist } = options;
  const { requireCleanWorkingDir, requireUpstream } = git;

  if (!(await Git.isGitRepo())) {
    throw new GitRepoError();
  }

  const remoteUrl = await Git.getRemoteUrl(git.pushRepo);
  if (!remoteUrl) {
    throw new GitRemoteUrlError();
  }

  if (requireCleanWorkingDir && !(await Git.isWorkingDirClean())) {
    throw new GitCleanWorkingDirError();
  }

  const hasUpstream = await Git.hasUpstream();
  if (requireUpstream && !hasUpstream) {
    throw new GitUpstreamError();
  }

  const isGithubRelease = github.release || dist.github.release;
  if (isGithubRelease && !config.githubToken) {
    throw new GithubTokenError(github.tokenRef);
  }

  if (dist.repo) {
    if (!isSubDir(dist.stageDir)) {
      throw new DistRepoStageDirError(dist.stageDir);
    }
  }

  return {
    remoteUrl,
    hasUpstream
  };
};

module.exports = async options => {
  config.assignOptions(options);

  try {
    handleDeprecated(config.options);

    const { options, isInteractive } = config;
    const { git, github, npm, pkgFiles, dist } = options;
    const { scripts } = options;
    const { commitMessage: message, commitArgs, tagName, tagAnnotation, tagArgs, addUntrackedFiles } = git;

    const getChangelog = async () => {
      const changelog = await Git.getChangelog({ command: scripts.changelog, tagName, latestVersion });
      if (changelog) {
        info(`${EOL}Changelog:${EOL}${truncateLines(changelog)}${EOL}`);
      } else {
        warn(`Empty changelog`);
      }
      return changelog;
    };

    debugConfig('%O', options);

    await spinner(scripts.beforeStart, () => run(scripts.beforeStart), format(scripts.beforeStart));

    const { remoteUrl, hasUpstream } = await validateRepoState(options);
    let { latestVersion, version: provisionalVersion } = await parseVersion(options);
    const isLateChangeLog = getIsLateChangeLog(options);

    const repo = repoPathParse(remoteUrl);
    config.setOption('repo', repo);
    config.setOption('latestVersion', latestVersion);
    config.setOption('version', provisionalVersion);

    const suffix = provisionalVersion ? `${latestVersion}...${provisionalVersion}` : `currently at ${latestVersion}`;
    log(`🚀 Let's release ${options.name} (${suffix})`);

    if (!isLateChangeLog) {
      const changelog = await getChangelog();
      config.setOption('changelog', changelog);
    }

    if (isInteractive && !provisionalVersion) {
      await prompt(true, 'src', 'incrementList', async increment => {
        if (increment) {
          provisionalVersion = semver.inc(latestVersion, increment, options.preReleaseId);
        } else {
          await prompt(true, 'src', 'version', version => {
            provisionalVersion = version;
          });
        }
      });
    }

    const version = provisionalVersion;
    config.setOption('version', version);
    config.setOption('preRelease', !!semver.prerelease(version));
    config.setOption('npm.tag', npmClient.getTag());

    if (!version) {
      throw new InvalidVersionError();
    }

    if (pkgFiles && git.requireCleanWorkingDir) {
      process.on('exit', () => Git.reset(pkgFiles));
    }

    await spinner(scripts.beforeBump, () => run(scripts.beforeBump), format(scripts.beforeBump));
    await spinner(true, () => bump(pkgFiles, version), 'Bump version');
    await spinner(scripts.afterBump, () => run(scripts.afterBump), format(scripts.afterBump));

    if (isLateChangeLog) {
      const changelog = await getChangelog();
      config.setOption('changelog', changelog);
    }

    const changelog = config.getOption('changelog');

    await spinner(scripts.beforeStage, () => run(scripts.beforeStage), format(scripts.beforeStage));
    await Git.stage(pkgFiles);
    await Git.stageDir({ addUntrackedFiles });

    const changeSet = await Git.status();
    if (changeSet) {
      info(`${EOL}Changeset:${EOL}${truncateLines(changeSet)}${EOL}`);
    } else {
      warn(`Empty changeset`);
    }

    if (dist.repo) {
      const {
        pkgFiles,
        git: { addUntrackedFiles },
        scripts
      } = dist;
      await spinner(dist.repo, () => Git.clone(dist.repo, dist.stageDir), 'Clone');
      await copy(dist.files, { cwd: dist.baseDir }, dist.stageDir);
      await pushd(dist.stageDir);
      await bump(pkgFiles, version);
      await spinner(scripts.beforeStage, () => run(scripts.beforeStage), format(scripts.beforeStage));
      await Git.stageDir({ addUntrackedFiles });
      await popd();
    }

    const commit = () => Git.commit({ path: '.', message, args: commitArgs });
    const tag = () => Git.tag({ name: tagName, annotation: tagAnnotation, args: tagArgs });
    const push = () =>
      Git.push({
        pushRepo: git.pushRepo,
        hasUpstreamBranch: hasUpstream,
        args: git.pushArgs
      });
    const release = () => githubClient.release({ version, tagName, repo, changelog, github });
    const uploadAssets = release => githubClient.uploadAssets({ release, repo, github });
    const otpPrompt = task => prompt(true, 'src', 'otp', task);
    const publish = () => npmClient.publish(npm, isInteractive && otpPrompt);

    if (!isInteractive) {
      await spinner(git.commit, commit, 'Git commit');
      await spinner(git.tag, tag, 'Git tag');
      await spinner(git.push, push, 'Git push');
      const releaseInfo = await spinner(github.release, release, 'GitHub release');
      await spinner(github.assets && releaseInfo, () => uploadAssets(releaseInfo), 'GitHub upload assets');
      if (!npm.private) {
        await spinner(npm.publish, publish, 'npm publish');
      }
    } else {
      await prompt(git.commit, 'src', 'commit', commit);
      await prompt(git.tag, 'src', 'tag', tag);
      await prompt(git.push, 'src', 'push', push);
      await prompt(github.release, 'src', 'release', async () => {
        const releaseInfo = await release();
        return github.assets && releaseInfo && (await uploadAssets(releaseInfo));
      });
      if (!npm.private) {
        await prompt(npm.publish, 'src', 'publish', publish);
      }
    }

    await spinner(scripts.afterRelease, () => run(scripts.afterRelease), format(scripts.afterRelease));

    if (dist.repo) {
      log(`${EOL}🚀 Let's release the distribution repo for ${options.name}${EOL}`);

      await pushd(dist.stageDir);

      const { git, github, npm } = dist;

      _.defaults(git, options.git);
      _.defaults(github, options.github);
      _.defaults(npm, options.npm);

      const { commitMessage: message, tagName, tagAnnotation, commitArgs, tagArgs, pushArgs } = git;
      const remoteUrl = await Git.getRemoteUrl();
      const distRepo = repoPathParse(remoteUrl);
      const isSameRepo = Git.isSameRepo(repo, distRepo);
      const shouldTag =
        (git.tag && !isSameRepo) || (isSameRepo && tagName !== options.git.tagName) || (git.tag && !options.git.tag);

      const commit = () => Git.commit({ path: '.', message, args: commitArgs });
      const tag = () => Git.tag({ name: tagName, annotation: tagAnnotation, args: tagArgs });
      const push = () => Git.push({ args: pushArgs });
      const release = () =>
        githubClient.release({
          version,
          tagName,
          repo: distRepo,
          changelog,
          github
        });
      const uploadAssets = release =>
        githubClient.uploadAssets({
          release,
          repo: distRepo,
          github
        });
      const otpPrompt = task => prompt(isInteractive, 'dist', 'otp', task);
      const publish = () => npmClient.publish(npm, isInteractive && otpPrompt);

      if (!isInteractive) {
        await Git.status();
        await spinner(git.commit, commit, 'Git commit');
        await spinner(shouldTag, tag, 'Git tag');
        await spinner(git.push, push, 'Git push');
        const releaseInfo = await spinner(github.release, release, 'GitHub release');
        await spinner(github.assets && releaseInfo, () => uploadAssets(releaseInfo), 'GitHub upload assets');
        await spinner(npm.publish, publish, 'npm publish');
      } else {
        info(`Changeset:${EOL}${await Git.status()}${EOL}`);
        await prompt(git.commit, 'dist', 'commit', commit);
        await prompt(shouldTag, 'dist', 'tag', tag);
        await prompt(git.push, 'dist', 'push', push);
        await prompt(github.release, 'dist', 'release', async () => {
          const releaseInfo = await release();
          return github.assets && releaseInfo && (await uploadAssets(releaseInfo));
        });
        await prompt(npm.publish, 'dist', 'publish', publish);
      }

      await spinner(scripts.afterRelease, () => run(scripts.afterRelease), format(scripts.afterRelease));
      await popd();

      await run(`!rm -rf ${dist.stageDir}`);
    }

    if (github.release) {
      log(`🔗 ${githubClient.getReleaseUrl()}`);
    }
    if (npm.publish) {
      log(`🔗 ${npmClient.getPackageUrl(options.name)}`);
    }

    log(`🏁 Done (in ${Math.floor(process.uptime())}s.)`);

    return Promise.resolve({
      changelog,
      latestVersion,
      version
    });
  } catch (err) {
    logError(err.message || err);
    debug(err);
    throw err;
  }
};
