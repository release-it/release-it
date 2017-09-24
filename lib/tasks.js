import * as shell from './shell';
import * as git from './git';
import * as githubClient from './github-client';
import prompt from './prompt';
import * as util from './util';
import { config } from './config';
import * as log from './log';
import { debug, debugConfig } from './debug';
import repoPathParse from 'parse-repo';
import _ from 'lodash';
import spinner, { getSpinner } from './spinner';

const noop = () => Promise.resolve();

export default async function run() {
  let initSpinner;

  try {
    const { options, isInteractive } = config;
    const { src, github, npm, changelogCommand, dist } = options;

    debugConfig('%O', options);

    const { latestVersion, version } = await util.parseVersion(options);

    initSpinner = getSpinner().start(`Init (release ${version} for ${options.name})`);

    const remoteUrl = await git.getRemoteUrl();
    const repo = repoPathParse(remoteUrl);
    const changelog = await git.getChangelog({ changelogCommand, tagName: src.tagName, latestVersion });

    const isGithubRelease = github.release || dist.github.release;
    if (isGithubRelease && !github.token) {
      throw new Error(`Environment variable ${github.tokenRef} is required for GitHub releases.`);
    }

    await shell.runTemplateCommand(src.beforeStartCommand);
    await git.isGitRepo();

    if (options.requireCleanWorkingDir && !await git.isWorkingDirClean()) {
      throw new Error('Working dir must be clean.');
    }

    initSpinner.succeed();
    initSpinner = null;

    await spinner(!!options.pkgFiles, () => shell.bump(options.pkgFiles, version), 'Bump version');
    await spinner(!!options.buildCommand, () => shell.runTemplateCommand(options.buildCommand), 'Build');
    await git.stage(options.pkgFiles);
    await git.stageDir();

    const { path: stageDir, cleanup: rmStageDir } = dist.repo ? await shell.mkStageDir(dist.stageDir) : {};

    if (dist.repo) {
      const initDistSpinner = getSpinner().start('Init (dist repo)');
      await git.clone(dist.repo, stageDir);
      await shell.copy(dist.files, { cwd: dist.baseDir }, stageDir);
      await shell.pushd(stageDir);
      await shell.bump(dist.pkgFiles);
      await shell.runTemplateCommand(dist.beforeStageCommand);
      await git.stageDir();
      await git.hasChanges('dist');
      await shell.popd();
      initDistSpinner.succeed();
    }

    const { commitMessage, tagName, tagAnnotation } = options.src;

    const status = () => git.status();
    const commit = () => git.commit('.', commitMessage, version);
    const tag = () => git.tag(version, tagName, tagAnnotation);
    const push = () => git.push(src.pushRepo);
    const release = () => githubClient.release({ version, tagName, repo, changelog, github });
    const uploadAssets = releaseId => githubClient.uploadAssets({ releaseId, repo, github });
    const publish = () => shell.npmPublish(npm, options.name);

    if (!isInteractive) {
      await status();
      await spinner(src.commit, commit, 'Git commit');
      await spinner(src.tag, tag, 'Git tag');
      await spinner(src.push, push, 'Git push');
      const releaseInfo = await spinner(github.release, release, 'GitHub release');
      await spinner(!!releaseInfo, () => uploadAssets(releaseInfo.id), 'GitHub upload assets');
      if (!npm.private) {
        await spinner(npm.publish, publish, 'npm publish');
      }
    } else {
      await prompt('src', version, 'status', status);
      await prompt('src', version, 'commit', commit);
      await prompt('src', version, 'tag', tag);
      await prompt('src', version, 'push', push);
      await prompt('src', version, 'release', async () => {
        const releaseInfo = await release();
        return releaseInfo && (await uploadAssets(releaseInfo.id));
      });

      if (!npm.private) {
        await prompt('src', version, 'publish', publish);
      }
    }

    await shell.runTemplateCommand(options.src.afterReleaseCommand);

    if (dist.repo) {
      await shell.pushd(stageDir);

      const { commitMessage, tagName, tagAnnotation, github, npm } = dist;
      const remoteUrl = await git.getRemoteUrl();
      const distRepo = repoPathParse(remoteUrl);
      const isSameRepo = util.isSameRepo(repo, distRepo);
      const shouldTag = (dist.tag && !isSameRepo) || (isSameRepo && tagName !== src.tagName);

      _.defaults(github, options.github);
      _.defaults(npm, options.npm);

      const commit = () => git.commit('.', commitMessage, version);
      const tag = () => git.tag(version, tagName, tagAnnotation);
      const push = () => git.push();
      const release = () => githubClient.release({ version, tagName, repo: distRepo, changelog, github });
      const uploadAssets = releaseId => githubClient.uploadAssets({ releaseId, repo: distRepo, github });
      const publish = () => shell.npmPublish(npm, options.name);

      if (!isInteractive) {
        await status();
        await spinner(dist.commit, commit, 'Git commit (dist repo)');
        await spinner(shouldTag, tag, 'Git tag (dist repo)');
        await spinner(dist.push, push, 'Git push (dist repo)');
        const releaseInfo = await spinner(github.release, release, 'GitHub release (dist repo)');
        await spinner(!!releaseInfo, () => uploadAssets(releaseInfo.id), 'GitHub upload assets (dist repo)');
        await spinner(npm.publish, publish, 'npm publish (dist repo)');
      } else {
        await prompt('dist', version, 'status', status);
        await prompt('dist', version, 'commit', commit);
        await prompt('dist', version, 'tag', tag);
        await prompt('dist', version, 'push', push);
        await prompt('dist', version, 'release', [release, uploadAssets]);
        await prompt('dist', version, 'publish', publish);
      }

      await shell.runTemplateCommand(dist.afterReleaseCommand);
      await shell.popd();

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
}
