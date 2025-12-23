import path from 'node:path';
import childProcess from 'node:child_process';
import { appendFileSync, mkdirSync, renameSync } from 'node:fs';
import test, { after, afterEach, before, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import semver from 'semver';
import Config from '../lib/config.js';
import runTasks from '../lib/index.js';
import Git from '../lib/plugin/git/Git.js';
import { execOpts } from '../lib/util.js';
import { mkTmpDir, gitAdd, getArgs } from './util/helpers.js';
import ShellStub from './stub/shell.js';
import {
  interceptUser as interceptGitLabUser,
  interceptCollaborator as interceptGitLabCollaborator,
  interceptPublish as interceptGitLabPublish,
  interceptAsset as interceptGitLabAsset
} from './stub/gitlab.js';
import {
  interceptAuthentication as interceptGitHubAuthentication,
  interceptCollaborator as interceptGitHubCollaborator,
  interceptCreate as interceptGitHubCreate,
  interceptAsset as interceptGitHubAsset
} from './stub/github.js';
import { factory, LogStub, SpinnerStub } from './util/index.js';
import { mockFetch } from './util/mock.js';

describe('tasks', () => {
  const rootDir = new URL('..', import.meta.url);

  const [mocker, github, assets, gitlab] = mockFetch([
    'https://api.github.com',
    'https://uploads.github.com',
    'https://gitlab.com/api/v4'
  ]);

  const npmMajorVersion = semver.major(process.env.npm_config_user_agent.match(/npm\/([^ ]+)/)[1]);

  const testConfig = {
    ci: true,
    config: false
  };

  const log = new LogStub();
  const spinner = new SpinnerStub();

  const getContainer = options => {
    const config = new Config(Object.assign({}, testConfig, options));
    const shell = new ShellStub({ container: { log, config } });
    return { log, spinner, config, shell };
  };

  before(() => {
    mocker.mockGlobal();
  });

  let bare;
  let target;
  beforeEach(async () => {
    bare = mkTmpDir();
    target = mkTmpDir();
    process.chdir(bare);
    childProcess.execSync(`git init --bare .`, execOpts);
    childProcess.execSync(`git clone ${bare} ${target}`, execOpts);
    process.chdir(target);
    gitAdd('line', 'file', 'Add file');
  });

  afterEach(() => {
    mocker.clearAll();
    log.resetCalls();
  });

  after(() => {
    mocker.unmockGlobal();
  });

  test('should run tasks without throwing errors', async () => {
    renameSync('.git', 'foo');
    const { name, latestVersion, version } = await runTasks({}, getContainer());
    assert(log.obtrusive.mock.calls[0].arguments[0].includes(`release ${name} (${latestVersion}...${version})`));
    assert.match(log.log.mock.calls.at(-1).arguments[0], /Done \(in [0-9]+s\.\)/);
  });

  test('should run tasks without package.json', async () => {
    childProcess.execSync('git tag 1.0.0', execOpts);
    gitAdd('line', 'file', 'Add file');
    const { name } = await runTasks({}, getContainer({ increment: 'major', git: { commit: false } }));
    assert(log.obtrusive.mock.calls[0].arguments[0].includes(`release ${name} (1.0.0...2.0.0)`));
    assert.match(log.log.mock.calls.at(-1).arguments[0], /Done \(in [0-9]+s\.\)/);
    assert.equal(log.warn.mock.callCount(), 0);
    const stdout = childProcess.execSync('git describe --tags --match=* --abbrev=0', {
      encoding: 'utf-8'
    });
    assert.equal(stdout.trim(), '2.0.0');
  });

  test('should disable plugins', async () => {
    gitAdd('{"name":"my-package","version":"1.2.3"}', 'package.json', 'Add package.json');
    childProcess.execSync('git tag 1.2.3', execOpts);
    gitAdd('line', 'file', 'Add file');
    const container = getContainer({ increment: 'minor', git: false, npm: false });
    const { latestVersion, version } = await runTasks({}, container);
    assert.equal(latestVersion, '0.0.0');
    assert.equal(version, '0.1.0');
    assert.match(log.log.mock.calls.at(-1).arguments[0], /Done \(in [0-9]+s\.\)/);
  });

  test('should run tasks with minimal config and without any warnings/errors', async () => {
    gitAdd('{"name":"my-package","version":"1.2.3"}', 'package.json', 'Add package.json');
    childProcess.execSync('git tag 1.2.3', execOpts);
    gitAdd('line', 'file', 'More file');
    await runTasks({}, getContainer({ increment: 'patch' }));
    assert(log.obtrusive.mock.calls[0].arguments[0].includes('release my-package (1.2.3...1.2.4)'));
    assert.match(log.log.mock.calls.at(-1).arguments[0], /Done \(in [0-9]+s\.\)/);
    const stdout = childProcess.execSync('git describe --tags --match=* --abbrev=0', { encoding: 'utf-8' });
    assert.equal(stdout.trim(), '1.2.4');
  });

  test('should use pkg.version', async () => {
    gitAdd('{"name":"my-package","version":"1.2.3"}', 'package.json', 'Add package.json');
    await runTasks({}, getContainer({ increment: 'minor' }));
    assert(log.obtrusive.mock.calls[0].arguments[0].includes('release my-package (1.2.3...1.3.0)'));
    assert.match(log.log.mock.calls.at(-1).arguments[0], /Done \(in [0-9]+s\.\)/);
    const stdout = childProcess.execSync('git describe --tags --match=* --abbrev=0', { encoding: 'utf-8' });
    assert.equal(stdout.trim(), '1.3.0');
  });

  test('should use pkg.version (in sub dir) w/o tagging repo', async t => {
    gitAdd('{"name":"root-package","version":"1.0.0"}', 'package.json', 'Add package.json');
    childProcess.execSync('git tag 1.0.0', execOpts);
    mkdirSync('my-package');
    process.chdir('my-package');
    gitAdd('{"name":"my-package","version":"1.2.3"}', 'package.json', 'Add package.json');
    const container = getContainer({ increment: 'minor', git: { tag: false } });
    const exec = t.mock.method(container.shell, 'exec');
    await runTasks({}, container);
    assert(log.obtrusive.mock.calls[0].arguments[0].endsWith('release my-package (1.2.3...1.3.0)'));
    assert.match(log.log.mock.calls.at(-1).arguments[0], /Done \(in [0-9]+s\.\)/);
    const stdout = childProcess.execSync('git describe --tags --match=* --abbrev=0', { encoding: 'utf-8' });
    assert.equal(stdout.trim(), '1.0.0');
    const npmArgs = getArgs(exec, 'npm');
    assert.equal(npmArgs[5], 'npm version 1.3.0 --no-git-tag-version --workspaces=false');
  });

  test('should ignore version in pkg.version and use git tag instead', async () => {
    gitAdd('{"name":"my-package","version":"0.0.0"}', 'package.json', 'Add package.json');
    childProcess.execSync('git tag 1.1.1', execOpts);
    gitAdd('line', 'file', 'More file');
    await runTasks({}, getContainer({ increment: 'minor', npm: { ignoreVersion: true } }));
    assert(log.obtrusive.mock.calls[0].arguments[0].includes('release my-package (1.1.1...1.2.0)'));
    assert.match(log.log.mock.calls.at(-1).arguments[0], /Done \(in [0-9]+s\.\)/);
    const stdout = childProcess.execSync('git describe --tags --match=* --abbrev=0', { encoding: 'utf-8' });
    assert.equal(stdout.trim(), '1.2.0');
  });

  test('should release all the things (basic)', async t => {
    const project = path.basename(bare);
    const pkgName = path.basename(target);
    const owner = path.basename(path.dirname(bare));
    gitAdd(`{"name":"${pkgName}","version":"1.0.0"}`, 'package.json', 'Add package.json');
    childProcess.execSync('git tag 1.0.0', execOpts);
    const sha = gitAdd('line', 'file', 'More file');

    interceptGitHubAuthentication(github);
    interceptGitHubCollaborator(github, { owner, project });
    interceptGitHubCreate(github, {
      owner,
      project,
      body: { tag_name: '1.0.1', name: 'Release 1.0.1', body: `* More file (${sha})`, prerelease: false }
    });

    const container = getContainer({
      github: { release: true, pushRepo: `https://github.com/${owner}/${project}` },
      npm: { name: pkgName }
    });

    const exec = t.mock.method(container.shell, 'exec');

    await runTasks({}, container);

    const npmArgs = getArgs(exec, 'npm');

    assert.deepEqual(npmArgs, [
      'npm ping',
      'npm whoami',
      `npm show ${pkgName}@latest version`,
      'npm --version',
      `npm access ${npmMajorVersion >= 9 ? 'list collaborators --json' : 'ls-collaborators'} ${pkgName}`,
      'npm version 1.0.1 --no-git-tag-version --workspaces=false',
      'npm publish . --tag latest --workspaces=false'
    ]);

    assert(log.obtrusive.mock.calls[0].arguments[0].endsWith(`release ${pkgName} (1.0.0...1.0.1)`));
    assert(log.log.mock.calls[0].arguments[0].endsWith(`https://www.npmjs.com/package/${pkgName}`));
    assert(log.log.mock.calls[1].arguments[0].endsWith(`https://github.com/${owner}/${project}/releases/tag/1.0.1`));
  });

  test('should release with correct tag name', async t => {
    const project = path.basename(bare);
    const pkgName = path.basename(target);
    const owner = path.basename(path.dirname(bare));
    const stdout = childProcess.execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' });
    const branchName = stdout.trim();
    gitAdd(`{"name":"${pkgName}","version":"1.0.0"}`, 'package.json', 'Add package.json');
    childProcess.execSync(`git tag ${pkgName}-${branchName}-1.0.0`, execOpts);
    const sha = gitAdd('line', 'file', 'More file');

    interceptGitHubCreate(github, {
      owner,
      project,
      body: {
        tag_name: `${pkgName}-${branchName}-1.0.1`,
        name: 'Release 1.0.1',
        body: `* More file (${sha})`,
        prerelease: false
      }
    });

    const container = getContainer({
      git: { tagName: '${npm.name}-${branchName}-${version}' },
      github: { release: true, skipChecks: true, pushRepo: `https://github.com/${owner}/${project}` }
    });

    const exec = t.mock.method(container.shell, 'exec');

    await runTasks({}, container);

    const gitArgs = getArgs(exec, 'git');

    assert(gitArgs.includes(`git tag --annotate --message Release 1.0.1 ${pkgName}-${branchName}-1.0.1`));
    assert(
      log.log.mock.calls[1].arguments[0].endsWith(`/${owner}/${project}/releases/tag/${pkgName}-${branchName}-1.0.1`)
    );
  });

  test('should release all the things (pre-release, github, gitlab)', async t => {
    const project = path.basename(bare);
    const pkgName = path.basename(target);
    const owner = path.basename(path.dirname(bare));
    const url = `https://gitlab.com/${owner}/${project}`;
    gitAdd(`{"name":"${pkgName}","version":"1.0.0"}`, 'package.json', 'Add package.json');
    childProcess.execSync('git tag v1.0.0', execOpts);
    const sha = gitAdd('line', 'file', 'More file');
    childProcess.execSync('git push --follow-tags', execOpts);
    const git = await factory(Git);
    const ref = (await git.getBranchName()) ?? 'HEAD';

    interceptGitHubAuthentication(github);
    interceptGitHubCollaborator(github, { owner, project });
    interceptGitHubAsset(assets, { owner, project, body: 'lineline' });
    interceptGitHubCreate(github, {
      owner,
      project,
      body: {
        tag_name: 'v1.1.0-alpha.0',
        name: 'Release 1.1.0-alpha.0',
        body: `Notes for ${pkgName} [v1.1.0-alpha.0]: ${sha}`,
        prerelease: true
      }
    });

    interceptGitLabUser(gitlab, { owner });
    interceptGitLabCollaborator(gitlab, { owner, project });
    interceptGitLabAsset(gitlab, { owner, project });
    interceptGitLabPublish(gitlab, {
      owner,
      project,
      body: {
        name: 'Release 1.1.0-alpha.0',
        ref,
        tag_name: 'v1.1.0-alpha.0',
        tag_message: `${owner} ${owner}/${project} ${project}`,
        description: `Notes for ${pkgName}: ${sha}`,
        assets: {
          links: [
            {
              name: 'file',
              url: `${url}/uploads/7e8bec1fe27cc46a4bc6a91b9e82a07c/file`
            }
          ]
        }
      }
    });

    const container = getContainer({
      increment: 'minor',
      preRelease: 'alpha',
      git: {
        changelog: 'git log --pretty=format:%h ${latestTag}...HEAD',
        commitMessage: 'Release ${version} for ${name} (from ${latestVersion})',
        tagAnnotation: '${repo.owner} ${repo.repository} ${repo.project}'
      },
      github: {
        release: true,
        pushRepo: `https://github.com/${owner}/${project}`,
        releaseNotes: 'echo Notes for ${name} [v${version}]: ${changelog}',
        assets: ['file']
      },
      gitlab: {
        release: true,
        pushRepo: url,
        releaseNotes: 'echo Notes for ${name}: ${changelog}',
        assets: ['file']
      },
      npm: { name: pkgName }
    });

    const exec = t.mock.method(container.shell, 'exec');

    process.env['GITLAB_TOKEN'] = '123';

    await runTasks({}, container);

    const npmArgs = getArgs(exec, 'npm');

    assert.deepEqual(npmArgs, [
      'npm ping',
      'npm whoami',
      `npm show ${pkgName}@latest version`,
      'npm --version',
      `npm access ${npmMajorVersion >= 9 ? 'list collaborators --json' : 'ls-collaborators'} ${pkgName}`,
      'npm version 1.1.0-alpha.0 --no-git-tag-version --workspaces=false',
      'npm publish . --tag alpha --workspaces=false'
    ]);

    const commitMessage = childProcess.execSync('git log --oneline --format=%B -n 1 HEAD', {
      encoding: 'utf-8'
    });
    assert.equal(commitMessage.trim(), `Release 1.1.0-alpha.0 for ${pkgName} (from 1.0.0)`);

    const tagName = childProcess.execSync('git describe --tags --match=* --abbrev=0', { encoding: 'utf-8' });
    assert.equal(tagName.trim(), 'v1.1.0-alpha.0');

    const tagAnnotation = childProcess.execSync('git for-each-ref refs/tags/v1.1.0-alpha.0 --format="%(contents)"', {
      encoding: 'utf-8'
    });
    assert.equal(tagAnnotation.trim(), `${owner} ${owner}/${project} ${project}`);

    assert(log.obtrusive.mock.calls[0].arguments[0].endsWith(`release ${pkgName} (1.0.0...1.1.0-alpha.0)`));
    assert(log.log.mock.calls[0].arguments[0].endsWith(`https://www.npmjs.com/package/${pkgName}`));
    assert(log.log.mock.calls[1].arguments[0].endsWith(`/${owner}/${project}/releases/tag/v1.1.0-alpha.0`));
    assert(log.log.mock.calls[2].arguments[0].endsWith(`/${project}/-/releases/v1.1.0-alpha.0`));
    assert.match(log.log.mock.calls.at(-1).arguments[0], /Done \(in [0-9]+s\.\)/);
  });

  test('should publish pre-release without pre-id with different npm.tag', async t => {
    const pkgName = path.basename(target);
    gitAdd(`{"name":"${pkgName}","version":"1.0.0"}`, 'package.json', 'Add package.json');
    childProcess.execSync('git tag v1.0.0', execOpts);

    const container = getContainer({ increment: 'major', preRelease: true, npm: { name: pkgName, tag: 'next' } });
    const exec = t.mock.method(container.shell, 'exec');

    await runTasks({}, container);

    const npmArgs = getArgs(exec, 'npm');
    assert.deepEqual(npmArgs, [
      'npm ping',
      'npm whoami',
      `npm show ${pkgName}@latest version`,
      'npm --version',
      `npm access ${npmMajorVersion >= 9 ? 'list collaborators --json' : 'ls-collaborators'} ${pkgName}`,
      'npm version 2.0.0-0 --no-git-tag-version --workspaces=false',
      'npm publish . --tag next --workspaces=false'
    ]);

    const stdout = childProcess.execSync('git describe --tags --match=* --abbrev=0', { encoding: 'utf-8' });
    assert.equal(stdout.trim(), 'v2.0.0-0');
    assert(log.obtrusive.mock.calls[0].arguments[0].endsWith(`release ${pkgName} (1.0.0...2.0.0-0)`));
    assert(log.log.mock.calls[0].arguments[0].endsWith(`https://www.npmjs.com/package/${pkgName}`));
    assert.match(log.log.mock.calls.at(-1).arguments[0], /Done \(in [0-9]+s\.\)/);
  });

  test('should handle private package correctly, bump lockfile', async t => {
    const pkgName = path.basename(target);
    gitAdd(`{"name":"${pkgName}","version":"1.0.0","private":true}`, 'package.json', 'Add package.json');
    gitAdd(`{"name":"${pkgName}","version":"1.0.0","private":true}`, 'package-lock.json', 'Add package-lock.json');

    const container = getContainer({ npm: { name: pkgName, private: true } });
    const exec = t.mock.method(container.shell, 'exec');

    await runTasks({}, container);

    const npmArgs = getArgs(exec, 'npm');
    assert.deepEqual(npmArgs, ['npm version 1.0.1 --no-git-tag-version --workspaces=false']);
    assert(log.obtrusive.mock.calls[0].arguments[0].endsWith(`release ${pkgName} (1.0.0...1.0.1)`));
    assert.equal(log.warn.length, 0);
    assert.match(log.log.mock.calls[0].arguments[0], /Done \(in [0-9]+s\.\)/);
  });

  test('should initially publish non-private scoped npm package privately', async t => {
    const pkgName = path.basename(target);
    gitAdd(`{"name":"@scope/${pkgName}","version":"1.0.0"}`, 'package.json', 'Add package.json');

    const container = getContainer({ npm: { name: pkgName } });

    const original = container.shell.exec.bind(container.shell);
    const exec = t.mock.method(container.shell, 'exec', (...args) => {
      if (args[0] === `npm show @scope/${pkgName}@latest version`) return Promise.reject();
      return original(...args);
    });

    await runTasks({}, container);

    const npmArgs = getArgs(exec, 'npm');
    assert.equal(npmArgs[6], 'npm publish . --tag latest --workspaces=false');
  });

  test('should use pkg.publishConfig.registry', async t => {
    const pkgName = path.basename(target);
    const registry = 'https://my-registry.example.org';

    gitAdd(
      JSON.stringify({
        name: pkgName,
        version: '1.2.3',
        publishConfig: { registry }
      }),
      'package.json',
      'Add package.json'
    );

    const container = getContainer();

    const exec = t.mock.method(container.shell, 'exec');

    await runTasks({}, container);

    const npmArgs = getArgs(exec, 'npm');
    assert.equal(npmArgs[0], `npm ping --registry ${registry}`);
    assert.equal(npmArgs[1], `npm whoami --registry ${registry}`);
    assert(container.log.log.mock.calls[0].arguments[0].endsWith(`${registry}/package/${pkgName}`));
  });

  test('should propagate errors', async () => {
    const config = {
      hooks: {
        'before:init': 'some-failing-command'
      }
    };
    const container = getContainer(config);

    await assert.rejects(runTasks({}, container), { message: /some-failing-command/ });

    assert.equal(log.error.mock.callCount(), 1);
  });

  test('should use custom changelog command with context', async t => {
    const project = path.basename(bare);
    const owner = path.basename(path.dirname(bare));
    childProcess.execSync('git tag v1.0.0', execOpts);
    gitAdd('line', 'file', 'More file');

    interceptGitHubAuthentication(github);
    interceptGitHubCollaborator(github, { owner, project });
    interceptGitHubCreate(github, {
      owner,
      project,
      body: {
        tag_name: 'v1.1.0',
        name: 'Release 1.1.0',
        body: 'custom-changelog-generator --from=v1.0.0 --to=v1.1.0',
        draft: false,
        prerelease: false
      }
    });

    const container = getContainer({
      increment: 'minor',
      github: {
        release: true,
        releaseNotes: 'echo custom-changelog-generator --from=${latestTag} --to=${tagName}',
        pushRepo: `https://github.com/${owner}/${project}`
      }
    });

    const exec = t.mock.method(container.shell, 'execStringCommand');

    await runTasks({}, container);

    const command = exec.mock.calls
      .map(call => call.arguments)
      .find(([command]) => command.includes('custom-changelog-generator'));

    assert.equal(command[0], 'echo custom-changelog-generator --from=v1.0.0 --to=v1.1.0');
  });

  test('should run all hooks', async t => {
    gitAdd(`{"name":"hooked","version":"1.0.0","type":"module"}`, 'package.json', 'Add package.json');
    childProcess.execSync(`npm install ${rootDir}`, execOpts);
    const plugin = "import { Plugin } from 'release-it'; class MyPlugin extends Plugin {}; export default MyPlugin;";

    appendFileSync('my-plugin.js', plugin);
    const hooks = {};
    ['before', 'after'].forEach(prefix => {
      ['version', 'git', 'npm', 'my-plugin'].forEach(ns => {
        ['init', 'beforeBump', 'bump', 'beforeRelease', 'release', 'afterRelease'].forEach(cycle => {
          hooks[`${prefix}:${cycle}`] = `echo ${prefix}:${cycle}`;
          hooks[`${prefix}:${ns}:${cycle}`] = `echo ${prefix}:${ns}:${cycle}`;
        });
      });
    });
    const container = getContainer({
      plugins: { './my-plugin.js': {} },
      git: { requireCleanWorkingDir: false },
      hooks
    });
    const exec = t.mock.method(container.shell, 'execFormattedCommand');

    await runTasks({}, container);

    const commands = getArgs(exec, 'echo');

    assert.deepEqual(commands, [
      'echo before:init',
      'echo before:my-plugin:init',
      'echo after:my-plugin:init',
      'echo before:npm:init',
      'echo after:npm:init',
      'echo before:git:init',
      'echo after:git:init',
      'echo before:version:init',
      'echo after:version:init',
      'echo after:init',
      'echo before:beforeBump',
      'echo before:my-plugin:beforeBump',
      'echo after:my-plugin:beforeBump',
      'echo before:npm:beforeBump',
      'echo after:npm:beforeBump',
      'echo before:git:beforeBump',
      'echo after:git:beforeBump',
      'echo before:version:beforeBump',
      'echo after:version:beforeBump',
      'echo after:beforeBump',
      'echo before:bump',
      'echo before:my-plugin:bump',
      'echo after:my-plugin:bump',
      'echo before:npm:bump',
      'echo after:npm:bump',
      'echo before:git:bump',
      'echo after:git:bump',
      'echo before:version:bump',
      'echo after:version:bump',
      'echo after:bump',
      'echo before:beforeRelease',
      'echo before:my-plugin:beforeRelease',
      'echo after:my-plugin:beforeRelease',
      'echo before:npm:beforeRelease',
      'echo after:npm:beforeRelease',
      'echo before:git:beforeRelease',
      'echo after:git:beforeRelease',
      'echo before:version:beforeRelease',
      'echo after:version:beforeRelease',
      'echo after:beforeRelease',
      'echo before:release',
      'echo before:npm:release',
      'echo after:npm:release',
      'echo before:git:release',
      'echo after:git:release',
      'echo before:version:release',
      'echo after:version:release',
      'echo before:my-plugin:release',
      'echo after:my-plugin:release',
      'echo after:release',
      'echo before:afterRelease',
      'echo before:npm:afterRelease',
      'echo after:npm:afterRelease',
      'echo before:git:afterRelease',
      'echo after:git:afterRelease',
      'echo before:version:afterRelease',
      'echo after:version:afterRelease',
      'echo before:my-plugin:afterRelease',
      'echo after:my-plugin:afterRelease',
      'echo after:afterRelease'
    ]);
  });
});
