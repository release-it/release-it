import test from 'ava';
import sh from 'shelljs';
import sinon from 'sinon';
import Log from '../lib/log.js';
import Spinner from '../lib/spinner.js';
import Config from '../lib/config.js';
import { parseGitUrl } from '../lib/util.js';
import runTasks from '../lib/tasks.js';
import MyPlugin from './stub/plugin.js';
import ReplacePlugin from './stub/plugin-replace.js';
import ContextPlugin from './stub/plugin-context.js';
import { mkTmpDir } from './util/helpers.js';
import ShellStub from './stub/shell.js';

const noop = Promise.resolve();

const sandbox = sinon.createSandbox();

const testConfig = {
  ci: true,
  config: false,
  'disable-metrics': true
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

test.serial.beforeEach(t => {
  const dir = mkTmpDir();
  sh.pushd('-q', dir);
  t.context = { dir };
});

test.serial.afterEach(() => {
  sandbox.resetHistory();
});

test.serial('should instantiate plugins and execute all release-cycle methods', async t => {
  sh.exec('npm init -f');

  sh.mkdir('my-plugin');
  sh.pushd('-q', 'my-plugin');
  sh.exec('npm link release-it');
  sh.ShellString("const { Plugin } = require('release-it'); module.exports = " + MyPlugin.toString()).toEnd('index.js');
  sh.popd();

  sh.mkdir('-p', 'my/plugin');
  sh.pushd('-q', 'my/plugin');
  sh.exec('npm link release-it');
  sh.ShellString("const { Plugin } = require('release-it'); module.exports = " + MyPlugin.toString()).toEnd('index.js');
  sh.popd();

  const config = {
    plugins: {
      'my-plugin': {
        name: 'foo'
      },
      './my/plugin': [
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

test.serial('should disable core plugins', async t => {
  sh.exec('npm init -f');
  sh.mkdir('replace-plugin');
  sh.pushd('-q', 'replace-plugin');
  sh.exec('npm link release-it');
  const content = "const { Plugin } = require('release-it'); module.exports = " + ReplacePlugin.toString();
  sh.ShellString(content).toEnd('index.js');
  sh.popd();

  const config = {
    plugins: {
      'replace-plugin': {}
    }
  };
  const container = getContainer(config);

  const result = await runTasks({}, container);

  t.deepEqual(result, {
    changelog: undefined,
    name: undefined,
    latestVersion: undefined,
    version: undefined
  });
});

test.serial('should support ESM-based plugins', async t => {
  sh.exec('npm init -f');
  sh.mkdir('my-plugin');
  sh.pushd('-q', 'my-plugin');
  sh.ShellString('{"name":"my-plugin","version":"1.0.0","type": "module"}').toEnd('package.json');
  sh.exec('npm link release-it');
  const content = "import { Plugin } from 'release-it'; " + MyPlugin.toString() + '; export default MyPlugin;';
  sh.ShellString(content).toEnd('index.js');
  sh.popd();

  const config = {
    plugins: {
      'my-plugin': {}
    }
  };
  const container = getContainer(config);

  const result = await runTasks({}, container);

  t.deepEqual(result, {
    changelog: undefined,
    name: 'new-project-name',
    latestVersion: '1.2.3',
    version: '1.3.0'
  });
});

test.serial('should expose context to execute commands', async t => {
  sh.ShellString('{"name":"pkg-name","version":"1.0.0"}').toEnd('package.json');
  const repo = parseGitUrl('https://github.com/user/pkg');

  sh.mkdir('context-plugin');
  sh.pushd('-q', 'context-plugin');
  sh.exec('npm link release-it');
  const content = "const { Plugin } = require('release-it'); module.exports = " + ContextPlugin.toString();
  sh.ShellString(content).toEnd('index.js');
  sh.popd();

  const container = getContainer({ plugins: { 'context-plugin': {} } });
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
