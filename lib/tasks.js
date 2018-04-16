const repoPathParse = require('parse-repo');
const _ = require('lodash');
const { bump, runTemplateCommand: run, pushd, copy, npmPublish, popd, mkTmpDir } = require('./shell');
const git = require('./git');
const githubClient = require('./github-client');
const prompt = require('./prompt');
const { truncateLines } = require('./util');
const { parse: parseVersion } = require('./version');
const { config } = require('./config');
const { info, warn, logError } = require('./log');
const { debug, debugConfig } = require('./debug');
const { spinner, getSpinner } = require('./spinner');

const validateRepoState = async options => {
  const { requireCleanWorkingDir, requireUpstream, github, dist } = options;

  if (!await git.isGitRepo()) {
    let err = new Error('Not a git repository');
    err.code = 'NOT_GIT_REPO';
    throw err;
  }

  const remoteUrl = await git.getRemoteUrl();
  if (!remoteUrl) {
    let err = new Error('Could not get remote Git url, add a remote `git remote add ...` and try again');
    err.code = 'NO_REMOTE_URL';
    throw err;
  }

  if (requireCleanWorkingDir && !await git.isWorkingDirClean()) {
    let err = new Error('Working dir must be clean, `git add` and got `commit all` changes before releasing');
    err.code = 'WORKING_DIR_MUST_BE_CLEAN';
    throw err;
  }

  const hasUpstream = await git.hasUpstream();
  if (requireUpstream && !hasUpstream) {
    let err = new Error(
      'No upstream configured for current branch, `git branch --set-upstream my_branch origin/my_branch`'
    );
    err.code = 'NO_UPSTREAM';
    throw err;
  }

  const isGithubRelease = github.release || dist.github.release;
  if (isGithubRelease && !github.token) {
    let err = new Error(`Environment variable ${github.tokenRef} is required for GitHub releases.`);
    err.code = 'NO_GITHUB_TOKENREF';
    throw err;
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
    const { options, isInteractive, isVerbose } = config;
    const { src, github, npm, safeBump, pkgFiles, dist } = options;
    const { beforeChangelogCommand, changelogCommand, buildCommand } = options;
    const {
      beforeStartCommand,
      commitMessage: message,
      commitArgs,
      tagName,
      tagAnnotation,
      afterReleaseCommand,
      addUntrackedFiles
    } = src;

    debugConfig('%O', options);

    await spinner(beforeStartCommand, () => run(beforeStartCommand), `Command (${beforeStartCommand})`);

    const { remoteUrl, hasUpstream } = await validateRepoState(options);

    const parsed = await parseVersion(options);

    if (parsed.version) {
      Object.assign(options, parsed);
    } else if (!parsed.version && isInteractive) {
      warn('Unable to find an existing Git tag, or package.json#version. No or invalid version provided.');
      await prompt(true, 'src', 'version', version => {
        Object.assign(options, {
          version
        });
      });
    } else {
      throw new Error(
        'Unable to find an existing Git tag, or package.json#version. No or invalid version provided.\n' +
          'Example: release-it 1.0.0'
      );
    }

    const { latestVersion, version } = options;

    const isUnsafeBump = pkgFiles && !safeBump;
    const isSafeBump = pkgFiles && safeBump;

    initSpinner = getSpinner().start(`Init (release ${version} for ${options.name})`);

    const repo = repoPathParse(remoteUrl);
    config.setOption('repo', repo);

    await spinner(isUnsafeBump, () => bump(pkgFiles, version), 'Bump version');

    await spinner(beforeChangelogCommand, () => run(beforeChangelogCommand), `Command (${beforeChangelogCommand})`);
    const changelog = await git.getChangelog({
      changelogCommand,
      tagName: src.tagName,
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
        const message = isSafeBump ? 'no changes were made' : 'you may have changes';
        throw new Error(`Cancelled (${message}).`);
      });
    }

    await spinner(isSafeBump, () => bump(pkgFiles, version), 'Bump version');
    await spinner(buildCommand, () => run(buildCommand), `Command (${buildCommand})`);
    await git.stage(pkgFiles);
    await git.stageDir({ addUntrackedFiles });

    const distStageDir = config.getResolvedDir('dist.stageDir');
    const { path: stageDir, cleanup: rmStageDir } = dist.repo ? await mkTmpDir(distStageDir) : {};

    if (dist.repo) {
      const { pkgFiles, beforeStageCommand, addUntrackedFiles } = dist;
      await spinner(dist.repo, () => git.clone(dist.repo, stageDir), 'Clone (dist repo)');
      await copy(dist.files, { cwd: dist.baseDir }, stageDir);
      await pushd(stageDir);
      await bump(pkgFiles, version);
      await spinner(beforeStageCommand, () => run(beforeStageCommand), `Command (${beforeStageCommand})`);
      await git.stageDir({ addUntrackedFiles });
      await git.hasChanges('dist');
      await popd();
    }

    const status = () => git.status();
    const commit = () => git.commit({ path: '.', message, version, args: commitArgs });
    const tag = () => git.tag(version, tagName, tagAnnotation);
    const push = () =>
      git.push({
        pushUrl: src.pushRepo,
        hasUpstreamBranch: hasUpstream,
        args: src.pushArgs
      });
    const release = () => githubClient.release({ version, tagName, repo, changelog, github });
    const uploadAssets = release => githubClient.uploadAssets({ release, repo, github });
    const publish = () => npmPublish(npm, options.name);

    if (!isInteractive) {
      await status();
      await spinner(src.commit, commit, 'Git commit');
      await spinner(src.tag, tag, 'Git tag');
      await spinner(src.push, push, 'Git push');
      const releaseInfo = await spinner(github.release, release, 'GitHub release');
      await spinner(releaseInfo, () => uploadAssets(releaseInfo), 'GitHub upload assets');
      if (!npm.private) {
        await spinner(npm.publish, publish, 'npm publish');
      }
    } else {
      await prompt(true, 'src', 'status', status);
      await prompt(src.commit, 'src', 'commit', commit);
      await prompt(src.tag, 'src', 'tag', tag);
      await prompt(src.push, 'src', 'push', push);
      await prompt(github.release, 'src', 'release', async () => {
        const releaseInfo = await release();
        return releaseInfo && (await uploadAssets(releaseInfo));
      });

      if (!npm.private) {
        await prompt(npm.publish, 'src', 'publish', publish);
      }
    }

    await spinner(afterReleaseCommand, () => run(afterReleaseCommand), `Command (${afterReleaseCommand})`);

    if (dist.repo) {
      await pushd(stageDir);

      const { commitMessage: message, tagName, tagAnnotation, github, npm, afterReleaseCommand } = dist;
      const remoteUrl = await git.getRemoteUrl();
      const distRepo = repoPathParse(remoteUrl);
      const isSameRepo = git.isSameRepo(repo, distRepo);
      const shouldTag = (dist.tag && !isSameRepo) || (isSameRepo && tagName !== src.tagName);

      _.defaults(github, options.github);
      _.defaults(npm, options.npm);

      const commit = () => git.commit({ path: '.', message, version, args: commitArgs });
      const tag = () => git.tag(version, tagName, tagAnnotation);
      const push = () => git.push({ args: dist.pushArgs });
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
      const publish = () => npmPublish(npm, options.name);

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

      await spinner(afterReleaseCommand, () => run(afterReleaseCommand), `Command (${afterReleaseCommand})`);
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
