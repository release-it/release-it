const repoPathParse = require('parse-repo');
const _ = require('lodash');
const { bump, runTemplateCommand: run, pushd, copy, npmPublish, popd, mkTmpDir } = require('./shell');
const Git = require('./git');
const githubClient = require('./github-client');
const semver = require('semver');
const prompt = require('./prompt');
const { truncateLines } = require('./util');
const { parse: parseVersion } = require('./version');
const { config } = require('./config');
const { log, info, logError } = require('./log');
const { debug, debugConfig } = require('./debug');
const { spinner, getSpinner } = require('./spinner');
const handleDeprecated = require('./deprecated');
const {
  GitRepoError,
  GitRemoteUrlError,
  GitCleanWorkingDirError,
  GitUpstreamError,
  GithubTokenError,
  InvalidVersionError,
  CancelError
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
  let initSpinner;

  config.assignOptions(options);

  try {
    handleDeprecated(config.options);

    const { options, isInteractive, isVerbose } = config;
    const { git, github, npm, safeBump, pkgFiles, dist } = options;
    const { scripts } = options;
    const { commitMessage: message, commitArgs, tagName, tagAnnotation, tagArgs, addUntrackedFiles } = git;

    debugConfig('%O', options);

    await spinner(scripts.beforeStart, () => run(scripts.beforeStart), scripts.beforeStart);

    const { remoteUrl, hasUpstream } = await validateRepoState(options);

    let { latestVersion, version: provisionalVersion } = await parseVersion(options);

    config.setOption('latestVersion', latestVersion);

    if (isInteractive) {
      log(`Let's release ${options.name} (current version: ${latestVersion})`);

      if (!provisionalVersion) {
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
    }

    const version = provisionalVersion;
    config.setOption('version', version);

    if (!version) {
      throw new InvalidVersionError();
    }

    const isUnsafeBump = pkgFiles && !safeBump;
    const isSafeBump = pkgFiles && safeBump;

    initSpinner = getSpinner().start(`Init (release ${version} for ${options.name})`);

    const repo = repoPathParse(remoteUrl);
    config.setOption('repo', repo);

    await spinner(isUnsafeBump, () => bump(pkgFiles, version), 'Bump version');

    await spinner(scripts.beforeChangelog, () => run(scripts.beforeChangelog), scripts.beforeChangelog);
    const changelog = await Git.getChangelog({
      command: scripts.changelog,
      tagName,
      latestVersion
    });
    config.setOption('changelog', changelog);

    initSpinner.succeed();
    initSpinner = null;

    if (isInteractive && !isVerbose && changelog) {
      info(truncateLines(changelog));
    }

    if (isInteractive) {
      await prompt(true, 'src', 'ready', () => {
        throw new CancelError(!isSafeBump);
      });
    }

    await spinner(isSafeBump, () => bump(pkgFiles, version), 'Bump version');
    await spinner(scripts.build, () => run(scripts.build), scripts.build);
    await Git.stage(pkgFiles);
    await Git.stageDir({ addUntrackedFiles });

    const distStageDir = config.getResolvedDir('dist.stageDir');
    const { path: stageDir, cleanup: rmStageDir } = dist.repo ? await mkTmpDir(distStageDir) : {};

    if (dist.repo) {
      const {
        pkgFiles,
        git: { addUntrackedFiles },
        scripts
      } = dist;
      await spinner(dist.repo, () => Git.clone(dist.repo, stageDir), 'Clone (dist repo)');
      await copy(dist.files, { cwd: dist.baseDir }, stageDir);
      await pushd(stageDir);
      await bump(pkgFiles, version);
      await spinner(scripts.beforeStage, () => run(scripts.beforeStage), scripts.beforeStage);
      await Git.stageDir({ addUntrackedFiles });
      await Git.hasChanges('dist');
      await popd();
    }

    const status = () => Git.status();
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
      await status();
      await spinner(git.commit, commit, 'Git commit');
      await spinner(git.tag, tag, 'Git tag');
      await spinner(git.push, push, 'Git push');
      const releaseInfo = await spinner(github.release, release, 'GitHub release');
      await spinner(releaseInfo, () => uploadAssets(releaseInfo), 'GitHub upload assets');
      if (!npm.private) {
        await spinner(npm.publish, publish, 'npm publish');
      }
    } else {
      await prompt(true, 'src', 'status', status);
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
      await pushd(stageDir);

      const { commitMessage: message, tagName, tagAnnotation, commitArgs, tagArgs, pushArgs } = dist;
      const { github, npm } = dist;
      const remoteUrl = await Git.getRemoteUrl();
      const distRepo = repoPathParse(remoteUrl);
      const isSameRepo = Git.isSameRepo(repo, distRepo);
      const shouldTag = (dist.tag && !isSameRepo) || (isSameRepo && tagName !== git.tagName) || (dist.tag && !git.tag);

      _.defaults(github, options.github);
      _.defaults(npm, options.npm);

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
        await status();
        await spinner(dist.commit, commit, 'Git commit (dist repo)');
        await spinner(shouldTag, tag, 'Git tag (dist repo)');
        await spinner(dist.push, push, 'Git push (dist repo)');
        const releaseInfo = await spinner(github.release, release, 'GitHub release (dist repo)');
        await spinner(releaseInfo, () => uploadAssets(releaseInfo), 'GitHub upload assets (dist repo)');
        await spinner(npm.publish, publish, 'npm publish (dist repo)');
      } else {
        await prompt(true, 'dist', 'status', status);
        await prompt(dist.commit, 'dist', 'commit', commit);
        await prompt(shouldTag, 'dist', 'tag', tag);
        await prompt(dist.push, 'dist', 'push', push);
        await prompt(github.release, 'dist', 'release', async () => {
          const releaseInfo = await release();
          return releaseInfo && (await uploadAssets(releaseInfo));
        });
        await prompt(npm.publish, 'dist', 'publish', publish);
      }

      await spinner(scripts.afterRelease, () => run(scripts.afterRelease), scripts.afterRelease);
      await popd();

      await rmStageDir();
    }

    getSpinner().succeed(`Done (in ${Math.floor(process.uptime())}s.)`);

    return Promise.resolve({
      changelog,
      latestVersion,
      version
    });
  } catch (err) {
    initSpinner && initSpinner.fail();
    logError(err.message || err);
    debug(err);
    throw err;
  }
};
