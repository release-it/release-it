import { resolve, join } from 'node:path';
import childProcess from 'node:child_process';
import fs, { appendFileSync, mkdirSync } from 'node:fs';
import test from 'ava';
import sinon from 'sinon';
import Log from '../lib/log.js';
import Spinner from '../lib/spinner.js';
import Config from '../lib/config.js';
import { execOpts, parseGitUrl } from '../lib/util.js';
import runTasks from '../lib/index.js';
import MyPlugin from './stub/plugin.js';
import ReplacePlugin from './stub/plugin-replace.js';
import ContextPlugin from './stub/plugin-context.js';
import { mkTmpDir } from './util/helpers.js';
import ShellStub from './stub/shell.js';

const noop = Promise.resolve();

const sandbox = sinon.createSandbox();

const testConfig = {
  ci: true,
  config: false
};

const log = sandbox.createStubInstance(Log);
const spinner = sandbox.createStubInstance(Spinner);
spinner.show.callsFake(({ enabled = true, task }) => (enabled ? task() : noop));

const getContainer = options => {
  const config = new Config(Object.assign({}, testConfig, options));
  const shell = new ShellStub({ container: { log, config } });
  return {
    log,
    spinner,
    config,
    shell
  };
};

test.before(t => {
  t.timeout(60 * 1000);
  childProcess.execSync('npm link', execOpts);
});

test.serial.beforeEach(t => {
  const dir = mkTmpDir();
  process.chdir(dir);
  t.context = { dir };
});

test.serial.afterEach(() => {
  sandbox.resetHistory();
});

test.serial('should instantiate plugins and execute all release-cycle methods', async t => {
  const { dir } = t.context;

  const pluginDir = mkTmpDir();
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

  t.deepEqual(container.log.info.args, [
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
  ]);

  t.deepEqual(result, {
    changelog: undefined,
    name: 'new-project-name',
    latestVersion: '1.2.3',
    version: '1.3.0'
  });
});

test.serial('should instantiate plugins and execute all release-cycle methods for scoped plugins', async t => {
  const { dir } = t.context;

  const pluginDir = mkTmpDir();
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

  t.deepEqual(container.log.info.args, [
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
  ]);

  t.deepEqual(result, {
    changelog: undefined,
    name: 'new-project-name',
    latestVersion: '1.2.3',
    version: '1.3.0'
  });
});

test.serial('should disable core plugins', async t => {
  const { dir } = t.context;

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

  t.deepEqual(result, {
    changelog: undefined,
    name: undefined,
    latestVersion: '0.0.0',
    version: undefined
  });
});

test.serial('should expose context to execute commands', async t => {
  const { dir } = t.context;

  fs.appendFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'pkg-name', version: '1.0.0', type: 'module' }));
  const content =
    "import { Plugin } from 'release-it'; " + ContextPlugin.toString() + '; export default ContextPlugin;';

  fs.appendFileSync(join(dir, 'context-plugin.js'), content);
  childProcess.execSync(`npm link release-it`, execOpts);

  const repo = parseGitUrl('https://github.com/user/pkg');

  const container = getContainer({ plugins: { './context-plugin.js': {} } });
  const exec = sinon.spy(container.shell, 'execFormattedCommand');

  container.config.setContext({ repo });
  container.config.setContext({ tagName: '1.0.1' });

  await runTasks({}, container);

  const pluginExecArgs = exec.args
    .map(args => args[0])
    .filter(arg => typeof arg === 'string' && arg.startsWith('echo'));

  t.deepEqual(pluginExecArgs, [
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
