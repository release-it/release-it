import { resolve, join } from 'node:path';
import childProcess from 'node:child_process';
import fs, { appendFileSync, mkdirSync } from 'node:fs';
import test, { afterEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import Config from '../lib/config.js';
import { execOpts, parseGitUrl } from '../lib/util.js';
import runTasks from '../lib/index.js';
import MyPlugin from './stub/plugin.js';
import ReplacePlugin from './stub/plugin-replace.js';
import ContextPlugin from './stub/plugin-context.js';
import { getArgs, mkTmpDir } from './util/helpers.js';
import ShellStub from './stub/shell.js';
import { LogStub, SpinnerStub } from './util/index.js';

describe('plugins', () => {
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

  childProcess.execSync('npm link', execOpts);

  afterEach(() => {
    log.resetCalls();
  });

  test('should instantiate plugins and execute all release-cycle methods', async () => {
    const pluginDir = mkTmpDir();
    const dir = mkTmpDir();
    process.chdir(pluginDir);

    appendFileSync(
      join(pluginDir, 'package.json'),
      JSON.stringify({ name: 'my-plugin', version: '1.0.0', type: 'module' })
    );
    childProcess.execSync(`npm link release-it`, execOpts);
    const content = "import { Plugin } from 'release-it'; " + MyPlugin.toString() + '; export default MyPlugin;';

    appendFileSync(join(pluginDir, 'index.js'), content);
    process.chdir(dir);
    mkdirSync(resolve('my/plugin'), { recursive: true });
    process.chdir('my/plugin');

    appendFileSync(join(dir, 'my', 'plugin', 'index.js'), content);
    process.chdir(dir);

    appendFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'project', version: '1.0.0', type: 'module' }));
    childProcess.execSync(`npm install ${pluginDir}`, execOpts);
    childProcess.execSync(`npm link release-it`, execOpts);

    const config = {
      plugins: {
        'my-plugin': {
          name: 'foo'
        },
        './my/plugin/index.js': [
          'named-plugin',
          {
            name: 'bar'
          }
        ]
      }
    };
    const container = getContainer(config);

    const result = await runTasks({}, container);

    assert.deepEqual(
      container.log.info.mock.calls.map(call => call.arguments),
      [
        ['my-plugin:foo:init'],
        ['named-plugin:bar:init'],
        ['my-plugin:foo:getName'],
        ['my-plugin:foo:getLatestVersion'],
        ['my-plugin:foo:getIncrement'],
        ['my-plugin:foo:getIncrementedVersionCI'],
        ['named-plugin:bar:getIncrementedVersionCI'],
        ['my-plugin:foo:beforeBump'],
        ['named-plugin:bar:beforeBump'],
        ['my-plugin:foo:bump:1.3.0'],
        ['named-plugin:bar:bump:1.3.0'],
        ['my-plugin:foo:beforeRelease'],
        ['named-plugin:bar:beforeRelease'],
        ['my-plugin:foo:release'],
        ['named-plugin:bar:release'],
        ['my-plugin:foo:afterRelease'],
        ['named-plugin:bar:afterRelease']
      ]
    );

    assert.deepEqual(result, {
      changelog: undefined,
      name: 'new-project-name',
      latestVersion: '1.2.3',
      version: '1.3.0'
    });
  });

  test('should instantiate plugins and execute all release-cycle methods for scoped plugins', async () => {
    const pluginDir = mkTmpDir();
    const dir = mkTmpDir();
    process.chdir(pluginDir);

    fs.writeFileSync(
      join(pluginDir, 'package.json'),
      JSON.stringify({ name: '@scoped/my-plugin', version: '1.0.0', type: 'module' })
    );
    childProcess.execSync(`npm link release-it`, execOpts);
    const content = "import { Plugin } from 'release-it'; " + MyPlugin.toString() + '; export default MyPlugin;';

    fs.writeFileSync(join(pluginDir, 'index.js'), content);
    process.chdir(dir);

    fs.writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'project', version: '1.0.0', type: 'module' }));
    childProcess.execSync(`npm install ${pluginDir}`, execOpts);
    childProcess.execSync(`npm link release-it`, execOpts);

    const config = {
      plugins: {
        '@scoped/my-plugin': {
          name: 'foo'
        }
      }
    };
    const container = getContainer(config);

    const result = await runTasks({}, container);

    assert.deepEqual(
      container.log.info.mock.calls.map(call => call.arguments),
      [
        ['@scoped/my-plugin:foo:init'],
        ['@scoped/my-plugin:foo:getName'],
        ['@scoped/my-plugin:foo:getLatestVersion'],
        ['@scoped/my-plugin:foo:getIncrement'],
        ['@scoped/my-plugin:foo:getIncrementedVersionCI'],
        ['@scoped/my-plugin:foo:beforeBump'],
        ['@scoped/my-plugin:foo:bump:1.3.0'],
        ['@scoped/my-plugin:foo:beforeRelease'],
        ['@scoped/my-plugin:foo:release'],
        ['@scoped/my-plugin:foo:afterRelease']
      ]
    );

    assert.deepEqual(result, {
      changelog: undefined,
      name: 'new-project-name',
      latestVersion: '1.2.3',
      version: '1.3.0'
    });
  });

  test('should disable core plugins', async () => {
    const dir = mkTmpDir();
    process.chdir(dir);

    fs.appendFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'project', version: '1.0.0' }));
    const content =
      "import { Plugin } from 'release-it'; " + ReplacePlugin.toString() + '; export default ReplacePlugin;';

    fs.appendFileSync(join(dir, 'replace-plugin.mjs'), content);
    childProcess.execSync(`npm link release-it`, execOpts);

    const config = {
      plugins: {
        './replace-plugin.mjs': {}
      }
    };
    const container = getContainer(config);

    const result = await runTasks({}, container);

    assert.deepEqual(result, {
      changelog: undefined,
      name: undefined,
      latestVersion: '0.0.0',
      version: undefined
    });
  });

  test('should expose context to execute commands', async t => {
    const dir = mkTmpDir();
    process.chdir(dir);

    fs.appendFileSync(
      join(dir, 'package.json'),
      JSON.stringify({ name: 'pkg-name', version: '1.0.0', type: 'module' })
    );
    const content =
      "import { Plugin } from 'release-it'; " + ContextPlugin.toString() + '; export default ContextPlugin;';

    fs.appendFileSync(join(dir, 'context-plugin.js'), content);
    childProcess.execSync(`npm link release-it`, execOpts);

    const repo = parseGitUrl('https://github.com/user/pkg');

    const container = getContainer({ plugins: { './context-plugin.js': {} } });
    const exec = t.mock.method(container.shell, 'execFormattedCommand');

    container.config.setContext({ repo });
    container.config.setContext({ tagName: '1.0.1' });

    await runTasks({}, container);

    const pluginExecArgs = getArgs(exec, 'echo');

    assert.deepEqual(pluginExecArgs, [
      'echo false',
      'echo false',
      `echo pkg-name user 1.0.0 1.0.1`,
      `echo pkg-name user 1.0.0 1.0.1`,
      `echo user pkg user/pkg 1.0.1`,
      `echo user pkg user/pkg 1.0.1`,
      `echo user pkg user/pkg 1.0.1`,
      `echo user pkg user/pkg 1.0.1`,
      `echo pkg 1.0.0 1.0.1 1.0.1`,
      `echo pkg 1.0.0 1.0.1 1.0.1`,
      `echo pkg 1.0.0 1.0.1 1.0.1`,
      `echo pkg 1.0.0 1.0.1 1.0.1`
    ]);
  });
});
