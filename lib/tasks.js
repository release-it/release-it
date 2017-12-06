const repoPathParse = require('parse-repo');
const _ = require('lodash');
const { bump, runTemplateCommand: run, pushd, copy, npmPublish, popd, mkTmpDir } = require('./shell');
const git = require('./git');
const githubClient = require('./github-client');
const prompt = require('./prompt');
const { truncateLines } = require('./util');
const { parse: parseVersion } = require('./version');
const { config } = require('./config');
const log = require('./log');
const { debug, debugConfig } = require('./debug');
const { spinner, getSpinner } = require('./spinner');

const noop = () => Promise.resolve();

module.exports = async options => {
  let initSpinner;

  config.assignOptions(options);

  try {
    const { options, isInteractive, isVerbose } = config;
    const { src, github, npm, changelogCommand, buildCommand, pkgFiles, dist } = options;
    const { beforeStartCommand, commitMessage, tagName, tagAnnotation, afterReleaseCommand } = src;

    debugConfig('%O', options);

    await spinner(beforeStartCommand, () => run(beforeStartCommand), `Command (${beforeStartCommand})`);

    if (!await git.isGitRepo()) {
      throw new Error('Not a git repository.');
    }

    const parsed = await parseVersion(options);

    if (parsed.version) {
      Object.assign(options, parsed);
    } else if (!parsed.version && isInteractive) {
      log.warn('Unable to find an existing Git tag, or package.json#version. No or invalid version provided.');
      await prompt('src', 'version', version => {
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

    initSpinner = getSpinner().start(`Init (release ${version} for ${options.name})`);

    const remoteUrl = await git.getRemoteUrl();
    const repo = repoPathParse(remoteUrl);
    const changelog = await git.getChangelog({ changelogCommand, tagName: src.tagName, latestVersion });

    const isGithubRelease = github.release || dist.github.release;
    if (isGithubRelease && !github.token) {
      throw new Error(`Environment variable ${github.tokenRef} is required for GitHub releases.`);
    }

    if (options.requireCleanWorkingDir && !await git.isWorkingDirClean()) {
      throw new Error('Working dir must be clean.');
    }

    initSpinner.succeed();
    initSpinner = null;

    if (isInteractive && !isVerbose && changelog) {
      log.info(truncateLines(changelog));
    }

    if (isInteractive) {
      await prompt('src', 'ready', () => {
        throw new Error('Cancelled (no changes were made).');
      });
    }

    await spinner(pkgFiles, () => bump(pkgFiles, version), 'Bump version');
    await spinner(buildCommand, () => run(buildCommand), `Command (${buildCommand})`);
    await git.stage(pkgFiles);
    await git.stageDir();

    const distStageDir = config.getResolvedDir('dist.stageDir');
    const { path: stageDir, cleanup: rmStageDir } = dist.repo ? await mkTmpDir(distStageDir) : {};

    if (dist.repo) {
      const { pkgFiles, beforeStageCommand } = dist;
      await spinner(dist.repo, () => git.clone(dist.repo, stageDir), 'Clone (dist repo)');
      await copy(dist.files, { cwd: dist.baseDir }, stageDir);
      await pushd(stageDir);
      await bump(pkgFiles, version);
      await spinner(beforeStageCommand, () => run(beforeStageCommand), `Command (${beforeStageCommand})`);
      await git.stageDir();
      await git.hasChanges('dist');
      await popd();
    }

    const status = () => git.status();
    const commit = () => git.commit('.', commitMessage, version);
    const tag = () => git.tag(version, tagName, tagAnnotation);
    const push = () => git.push(src.pushRepo);
    const release = () => githubClient.release({ version, tagName, repo, changelog, github });
    const uploadAssets = releaseId => githubClient.uploadAssets({ releaseId, repo, github });
    const publish = () => npmPublish(npm, options.name);

    if (!isInteractive) {
      await status();
      await spinner(src.commit, commit, 'Git commit');
      await spinner(src.tag, tag, 'Git tag');
      await spinner(src.push, push, 'Git push');
      const releaseInfo = await spinner(github.release, release, 'GitHub release');
      await spinner(releaseInfo, () => uploadAssets(releaseInfo.id), 'GitHub upload assets');
      if (!npm.private) {
        await spinner(npm.publish, publish, 'npm publish');
      }
    } else {
      await prompt('src', 'status', status);
      await prompt('src', 'commit', commit);
      await prompt('src', 'tag', tag);
      await prompt('src', 'push', push);
      await prompt('src', 'release', async () => {
        const releaseInfo = await release();
        return releaseInfo && (await uploadAssets(releaseInfo.id));
      });

      if (!npm.private) {
        await prompt('src', 'publish', publish);
      }
    }

    await spinner(afterReleaseCommand, () => run(afterReleaseCommand), `Command (${afterReleaseCommand})`);

    if (dist.repo) {
      await pushd(stageDir);

      const { commitMessage, tagName, tagAnnotation, github, npm, afterReleaseCommand } = dist;
      const remoteUrl = await git.getRemoteUrl();
      const distRepo = repoPathParse(remoteUrl);
      const isSameRepo = git.isSameRepo(repo, distRepo);
      const shouldTag = (dist.tag && !isSameRepo) || (isSameRepo && tagName !== src.tagName);

      _.defaults(github, options.github);
      _.defaults(npm, options.npm);

      const commit = () => git.commit('.', commitMessage, version);
      const tag = () => git.tag(version, tagName, tagAnnotation);
      const push = () => git.push();
      const release = () => githubClient.release({ version, tagName, repo: distRepo, changelog, github });
      const uploadAssets = releaseId => githubClient.uploadAssets({ releaseId, repo: distRepo, github });
      const publish = () => npmPublish(npm, options.name);

      if (!isInteractive) {
        await status();
        await spinner(dist.commit, commit, 'Git commit (dist repo)');
        await spinner(shouldTag, tag, 'Git tag (dist repo)');
        await spinner(dist.push, push, 'Git push (dist repo)');
        const releaseInfo = await spinner(github.release, release, 'GitHub release (dist repo)');
        await spinner(releaseInfo, () => uploadAssets(releaseInfo.id), 'GitHub upload assets (dist repo)');
        await spinner(npm.publish, publish, 'npm publish (dist repo)');
      } else {
        await prompt('dist', 'status', status);
        await prompt('dist', 'commit', commit);
        await prompt('dist', 'tag', tag);
        await prompt('dist', 'push', push);
        await prompt('dist', 'release', async () => {
          const releaseInfo = await release();
          return releaseInfo && (await uploadAssets(releaseInfo.id));
        });
        await prompt('dist', 'publish', publish);
      }

      await spinner(afterReleaseCommand, () => run(afterReleaseCommand), `Command (${afterReleaseCommand})`);
      await popd();

      await rmStageDir();
    }

    getSpinner().succeed(`Done (in ${Math.floor(process.uptime())}s.)`);

    return noop();
  } catch (err) {
    initSpinner && initSpinner.fail();
    log.error(err.message);
    debug(err);
    throw err;
  }
};
