import path from 'node:path';
import { renameSync } from 'node:fs';
import childProcess from 'node:child_process';
import test, { afterEach, after, before, beforeEach, describe, mock } from 'node:test';
import assert from 'node:assert/strict';
import Prompt from '../lib/prompt.js';
import Config from '../lib/config.js';
import runTasks from '../lib/index.js';
import Git from '../lib/plugin/git/Git.js';
import { execOpts } from '../lib/util.js';
import { mkTmpDir, gitAdd, getArgs } from './util/helpers.js';
import ShellStub from './stub/shell.js';
import { interceptPublish as interceptGitLabPublish } from './stub/gitlab.js';
import { interceptCreate as interceptGitHubCreate } from './stub/github.js';
import { factory, LogStub, SpinnerStub } from './util/index.js';
import { mockFetch } from './util/mock.js';
import { createTarBlobByRawContents } from './util/fetch.js';

describe('tasks.interactive', () => {
  const [mocker, github, gitlab] = mockFetch(['https://api.github.com', 'https://gitlab.com/api/v4']);

  before(() => {
    mocker.mockGlobal();
  });

  afterEach(() => {
    mocker.clearAll();
    prompt.mock.resetCalls();
    log.resetCalls();
  });

  after(() => {
    mocker.unmockGlobal();
  });

  const testConfig = {
    ci: false,
    config: false
  };

  const getHooks = plugins => {
    const hooks = {};
    ['before', 'after'].forEach(prefix => {
      plugins.forEach(ns => {
        ['init', 'beforeBump', 'bump', 'beforeRelease', 'release', 'afterRelease'].forEach(lifecycle => {
          hooks[`${prefix}:${lifecycle}`] = `echo ${prefix}:${lifecycle}`;
          hooks[`${prefix}:${ns}:${lifecycle}`] = `echo ${prefix}:${ns}:${lifecycle}`;
        });
      });
    });
    return hooks;
  };

  const log = new LogStub();
  const spinner = new SpinnerStub();

  const prompt = mock.fn(([options]) => {
    const answer = options.type === 'list' ? options.choices[0].value : options.name === 'version' ? '0.0.1' : true;
    return { [options.name]: answer };
  });

  const defaultInquirer = { prompt };

  const getContainer = (options, inquirer = defaultInquirer) => {
    const config = new Config(Object.assign({}, testConfig, options));
    const shell = new ShellStub({ container: { log, config } });
    const prompt = new Prompt({ container: { inquirer } });
    return { log, spinner, config, shell, prompt };
  };

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

  test('should run tasks without throwing errors', async () => {
    renameSync('.git', 'foo');
    const { name, latestVersion, version } = await runTasks({}, getContainer());
    assert.equal(version, '0.0.1');
    assert(log.obtrusive.mock.calls[0].arguments[0].includes(`release ${name} (currently at ${latestVersion})`));
    assert.match(log.log.mock.calls.at(-1).arguments[0], /Done \(in [0-9]+s\.\)/);
  });

  test('should run tasks using extended configuration', async t => {
    renameSync('.git', 'foo');

    const validationExtendedConfiguration = "echo 'extended_configuration'";

    github.head('/repos/release-it/release-it-configuration/tarball/main', {
      status: 200,
      headers: {}
    });

    github.get('/repos/release-it/release-it-configuration/tarball/main', {
      status: 200,
      body: await new Response(
        createTarBlobByRawContents({
          '.release-it.json': JSON.stringify({
            hooks: {
              'before:init': validationExtendedConfiguration
            }
          })
        })
      ).arrayBuffer()
    });

    const config = {
      $schema: 'https://unpkg.com/release-it@19/schema/release-it.json',
      extends: 'github:release-it/release-it-configuration',
      config: true
    };

    const container = getContainer(config);

    const exec = t.mock.method(container.shell, 'execFormattedCommand');

    const { name, latestVersion, version } = await runTasks({}, container);

    const commands = getArgs(exec, 'echo');

    assert(commands.includes(validationExtendedConfiguration));

    assert.equal(version, '0.0.1');
    assert(log.obtrusive.mock.calls[0].arguments[0].includes(`release ${name} (currently at ${latestVersion})`));
    assert.match(log.log.mock.calls.at(-1).arguments[0], /Done \(in [0-9]+s\.\)/);
  });

  test('should run tasks not using extended configuration as it is not a string', async () => {
    renameSync('.git', 'foo');

    const config = {
      $schema: 'https://unpkg.com/release-it@19/schema/release-it.json',
      extends: false
    };

    const container = getContainer(config);

    const { name, latestVersion, version } = await runTasks({}, container);

    assert.equal(version, '0.0.1');
    assert(log.obtrusive.mock.calls[0].arguments[0].includes(`release ${name} (currently at ${latestVersion})`));
    assert.match(log.log.mock.calls.at(-1).arguments[0], /Done \(in [0-9]+s\.\)/);
  });

  test('should not run hooks for disabled release-cycle methods', async t => {
    const hooks = getHooks(['version', 'git', 'github', 'gitlab', 'npm']);

    const container = getContainer({
      hooks,
      git: { push: false },
      github: { release: false },
      gitlab: { release: false },
      npm: { publish: false }
    });

    const exec = t.mock.method(container.shell, 'execFormattedCommand');

    await runTasks({}, container);

    const commands = getArgs(exec, 'echo');

    assert(commands.includes('echo before:init'));
    assert(commands.includes('echo after:afterRelease'));

    assert(!commands.includes('echo after:git:release'));
    assert(!commands.includes('echo after:github:release'));
    assert(!commands.includes('echo after:gitlab:release'));
    assert(!commands.includes('echo after:npm:release'));
  });

  test('should not run hooks for cancelled release-cycle methods', async t => {
    const pkgName = path.basename(target);
    gitAdd(`{"name":"${pkgName}","version":"1.0.0"}`, 'package.json', 'Add package.json');
    childProcess.execSync('git tag 1.0.0', execOpts);

    const hooks = getHooks(['version', 'git', 'github', 'gitlab', 'npm']);
    const prompt = mock.fn(([options]) => ({ [options.name]: false }));
    const inquirer = { prompt };

    const container = getContainer(
      {
        increment: 'minor',
        hooks,
        github: { release: true, skipChecks: true },
        gitlab: { release: true, skipChecks: true },
        npm: { publish: true, skipChecks: true }
      },
      inquirer
    );

    const exec = t.mock.method(container.shell, 'execFormattedCommand');

    await runTasks({}, container);

    const commands = getArgs(exec, 'echo');

    assert(commands.includes('echo before:init'));
    assert(commands.includes('echo after:afterRelease'));
    assert(commands.includes('echo after:git:bump'));
    assert(commands.includes('echo after:npm:bump'));

    assert(!commands.includes('echo after:git:release'));
    assert(!commands.includes('echo after:github:release'));
    assert(!commands.includes('echo after:gitlab:release'));
    assert(!commands.includes('echo after:npm:release'));
  });

  test('should run "after:*:release" plugin hooks', async t => {
    const project = path.basename(bare);
    const pkgName = path.basename(target);
    const owner = path.basename(path.dirname(bare));
    gitAdd(`{"name":"${pkgName}","version":"1.0.0"}`, 'package.json', 'Add package.json');
    childProcess.execSync('git tag 1.0.0', execOpts);
    const sha = gitAdd('line', 'file', 'More file');

    const git = await factory(Git);
    const ref = (await git.getBranchName()) ?? 'HEAD';

    interceptGitHubCreate(github, {
      owner,
      project,
      body: { tag_name: '1.1.0', name: 'Release 1.1.0', body: `* More file (${sha})` }
    });

    interceptGitLabPublish(gitlab, {
      owner,
      project,
      body: {
        name: 'Release 1.1.0',
        ref,
        tag_name: '1.1.0',
        tag_message: 'Release 1.1.0',
        description: `* More file (${sha})`
      }
    });

    const hooks = getHooks(['version', 'git', 'github', 'gitlab', 'npm']);

    const container = getContainer({
      increment: 'minor',
      hooks,
      github: { release: true, pushRepo: `https://github.com/${owner}/${project}`, skipChecks: true },
      gitlab: { release: true, pushRepo: `https://gitlab.com/${owner}/${project}`, skipChecks: true },
      npm: { name: pkgName, skipChecks: true }
    });

    const exec = t.mock.method(container.shell, 'execFormattedCommand');

    await runTasks({}, container);

    const commands = getArgs(exec, 'echo');

    assert(commands.includes('echo after:git:bump'));
    assert(commands.includes('echo after:npm:bump'));
    assert(commands.includes('echo after:git:release'));
    assert(commands.includes('echo after:github:release'));
    assert(commands.includes('echo after:gitlab:release'));
    assert(commands.includes('echo after:npm:release'));
  });

  test('should show only version prompt', async () => {
    const config = { ci: false, 'only-version': true };
    await runTasks({}, getContainer(config));
    assert.equal(prompt.mock.callCount(), 1);
    assert.equal(prompt.mock.calls[0].arguments[0][0].name, 'incrementList');
  });
});
