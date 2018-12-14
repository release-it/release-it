const { EOL } = require('os');
const repoPathParse = require('parse-repo');
const _ = require('lodash');
const { bump, runTemplateCommand: run, pushd, copy, popd } = require('./shell');
const { getTag, publish: npmPublish } = require('./npm');
const Git = require('./git');
const githubClient = require('./github-client');
const semver = require('semver');
const prompt = require('./prompt');
const { truncateLines } = require('./util');
const { parse: parseVersion } = require('./version');
const { getIsLateChangeLog } = require('./recommendations');
const { config } = require('./config');
const { info, warn, logError } = require('./log');
const { debug, debugConfig } = require('./debug');
const { spinner, getSpinner } = require('./spinner');
const handleDeprecated = require('./deprecated');
const {
  GitRepoError,
  GitRemoteUrlError,
  GitCleanWorkingDirError,
  GitUpstreamError,
  GithubTokenError,
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
  if (isGithubRelease && !github.token) {
    throw new GithubTokenError(github.tokenRef);
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

    await spinner(scripts.beforeStart, () => run(scripts.beforeStart), scripts.beforeStart);

    const { remoteUrl, hasUpstream } = await validateRepoState(options);
    let { latestVersion, version: provisionalVersion } = await parseVersion(options);
    const isLateChangeLog = getIsLateChangeLog(options);

    const repo = repoPathParse(remoteUrl);
    config.setOption('repo', repo);
    config.setOption('latestVersion', latestVersion);
    config.setOption('version', provisionalVersion);

    const suffix = provisionalVersion ? `${latestVersion}...${provisionalVersion}` : `currently at ${latestVersion}`;
    getSpinner().stopAndPersist({
      symbol: '🚀',
      text: `Let's release ${options.name} (${suffix})`
    });

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
    config.setOption('npm.tag', getTag());

    if (!version) {
      throw new InvalidVersionError();
    }

    await spinner(scripts.beforeBump, () => run(scripts.beforeBump), scripts.beforeBump);
    await spinner(true, () => bump(pkgFiles, version), 'Bump version');
    await spinner(scripts.afterBump, () => run(scripts.afterBump), scripts.afterBump);

    if (isLateChangeLog) {
      const changelog = await getChangelog();
      config.setOption('changelog', changelog);
    }

    const changelog = config.getOption('changelog');

    await spinner(scripts.beforeStage, () => run(scripts.beforeStage), scripts.beforeStage);
    await Git.stage(pkgFiles);
    await Git.stageDir({ addUntrackedFiles });

    const changeSet = await Git.status();
    if (changeSet) {
      info(`${EOL}Changeset:${EOL}${truncateLines(changeSet)}${EOL}`);
    } else {
      warn(`Empty changeset`);
    }

    const stagingDir = config.getResolvedDir('dist.stageDir');

    if (dist.repo) {
      const {
        pkgFiles,
        git: { addUntrackedFiles },
        scripts
      } = dist;
      await spinner(dist.repo, () => Git.clone(dist.repo, stagingDir), 'Clone (dist repo)');
      await copy(dist.files, { cwd: dist.baseDir }, stagingDir);
      await pushd(stagingDir);
      await bump(pkgFiles, version);
      await spinner(scripts.beforeStage, () => run(scripts.beforeStage), scripts.beforeStage);
      await Git.stageDir({ addUntrackedFiles });
      await Git.hasChanges('dist');
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
    const publish = () => npmPublish(npm, options.name, isInteractive && otpPrompt);

    if (!isInteractive) {
      await spinner(git.commit, commit, 'Git commit');
      await spinner(git.tag, tag, 'Git tag');
      await spinner(git.push, push, 'Git push');
      const releaseInfo = await spinner(github.release, release, 'GitHub release');
      await spinner(releaseInfo, () => uploadAssets(releaseInfo), 'GitHub upload assets');
      if (!npm.private) {
        await spinner(npm.publish, publish, 'npm publish');
      }
    } else {
      await prompt(git.commit, 'src', 'commit', commit);
      await prompt(git.tag, 'src', 'tag', tag);
      await prompt(git.push, 'src', 'push', push);
      await prompt(github.release, 'src', 'release', async () => {
        const releaseInfo = await release();
        return releaseInfo && (await uploadAssets(releaseInfo));
      });

      if (!npm.private) {
        await prompt(npm.publish, 'src', 'publish', publish);
      }
    }

    await spinner(scripts.afterRelease, () => run(scripts.afterRelease), scripts.afterRelease);

    if (dist.repo) {
      getSpinner().stopAndPersist({
        symbol: `${EOL}🚀`,
        text: `Let's release the distribution repo for ${options.name}${EOL}`
      });

      await pushd(stagingDir);

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
      const publish = () => npmPublish(npm, options.name, isInteractive && otpPrompt);

      if (!isInteractive) {
        await Git.status();
        await spinner(git.commit, commit, 'Git commit (dist repo)');
        await spinner(shouldTag, tag, 'Git tag (dist repo)');
        await spinner(git.push, push, 'Git push (dist repo)');
        const releaseInfo = await spinner(github.release, release, 'GitHub release (dist repo)');
        await spinner(releaseInfo, () => uploadAssets(releaseInfo), 'GitHub upload assets (dist repo)');
        await spinner(npm.publish, publish, 'npm publish (dist repo)');
      } else {
        info(`Changeset:${EOL}${await Git.status()}${EOL}`);
        await prompt(git.commit, 'dist', 'commit', commit);
        await prompt(shouldTag, 'dist', 'tag', tag);
        await prompt(git.push, 'dist', 'push', push);
        await prompt(github.release, 'dist', 'release', async () => {
          const releaseInfo = await release();
          return releaseInfo && (await uploadAssets(releaseInfo));
        });
        await prompt(npm.publish, 'dist', 'publish', publish);
      }

      await spinner(scripts.afterRelease, () => run(scripts.afterRelease), scripts.afterRelease);
      await popd();

      await run(`!rm -rf ${stagingDir}`);
    }

    getSpinner().stopAndPersist({
      symbol: `🏁`,
      text: `Done (in ${Math.floor(process.uptime())}s.)`
    });

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
