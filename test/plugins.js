const path = require('path');
const test = require('ava');
const sh = require('shelljs');
const proxyquire = require('proxyquire');
const sinon = require('sinon');
const Log = require('../lib/log');
const Spinner = require('../lib/spinner');
const Config = require('../lib/config');
const Plugin = require('../lib/plugin/Plugin');
const { mkTmpDir, gitAdd } = require('./util/helpers');
const ShellStub = require('./stub/shell');

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
  const bare = mkTmpDir();
  const target = mkTmpDir();
  sh.pushd('-q', bare);
  sh.exec(`git init --bare .`);
  sh.exec(`git clone ${bare} ${target}`);
  sh.pushd('-q', target);
  gitAdd('line', 'file', 'Add file');
  t.context = { bare, target };
});

test.serial.afterEach(() => {
  sandbox.resetHistory();
});

const myPlugin = sandbox.createStubInstance(Plugin);
myPlugin.namespace = 'my-plugin';
const MyPlugin = sandbox.stub().callsFake(() => myPlugin);
const myLocalPlugin = sandbox.createStubInstance(Plugin);
const MyLocalPlugin = sandbox.stub().callsFake(() => myLocalPlugin);
const replacePlugin = sandbox.createStubInstance(Plugin);
const ReplacePlugin = sandbox.stub().callsFake(() => replacePlugin);

const staticMembers = { isEnabled: () => true, disablePlugin: () => null };
const options = { '@global': true, '@noCallThru': true };
const runTasks = proxyquire('../lib/tasks', {
  'my-plugin': Object.assign(MyPlugin, staticMembers, options),
  '/my/plugin': Object.assign(MyLocalPlugin, staticMembers, options),
  'replace-plugin': Object.assign(ReplacePlugin, staticMembers, options, {
    disablePlugin: () => ['version', 'git']
  })
});

test.serial('should instantiate plugins and execute all release-cycle methods', async t => {
  const config = {
    plugins: {
      'my-plugin': {
        name: 'foo'
      },
      '/my/plugin': [
        'named-plugin',
        {
          name: 'bar'
        }
      ]
    }
  };
  const container = getContainer(config);

  await runTasks({}, container);

  t.is(MyPlugin.firstCall.args[0].namespace, 'my-plugin');
  t.deepEqual(MyPlugin.firstCall.args[0].options['my-plugin'], { name: 'foo' });
  t.is(MyLocalPlugin.firstCall.args[0].namespace, 'named-plugin');
  t.deepEqual(MyLocalPlugin.firstCall.args[0].options['named-plugin'], { name: 'bar' });

  [
    'init',
    'getName',
    'getLatestVersion',
    'getIncrement',
    'getIncrementedVersionCI',
    'beforeBump',
    'bump',
    'beforeRelease',
    'release',
    'afterRelease'
  ].forEach(method => {
    t.is(myPlugin[method].callCount, 1);
    t.is(myLocalPlugin[method].callCount, 1);
  });

  const incrementBase = { latestVersion: '0.0.0', increment: undefined, isPreRelease: false, preReleaseId: undefined };
  t.deepEqual(myPlugin.getIncrement.firstCall.args[0], incrementBase);
  t.deepEqual(myPlugin.getIncrementedVersionCI.firstCall.args[0], incrementBase);
  t.deepEqual(myLocalPlugin.getIncrementedVersionCI.firstCall.args[0], incrementBase);
  t.is(myPlugin.bump.firstCall.args[0], '0.0.1');
  t.is(myLocalPlugin.bump.firstCall.args[0], '0.0.1');
});

test.serial('should disable core plugins', async t => {
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
    latestVersion: '0.0.0',
    version: undefined
  });
});

test.serial('should expose context to execute commands', async t => {
  const { bare } = t.context;
  const latestVersion = '1.0.0';
  const project = path.basename(bare);
  const pkgName = 'plugin-context';
  const owner = path.basename(path.dirname(bare));
  gitAdd(`{"name":"${pkgName}","version":"${latestVersion}"}`, 'package.json', 'Add package.json');

  class MyPlugin extends Plugin {
    init() {
      this.exec('echo ${version.isPreRelease}');
    }
    beforeBump() {
      const context = this.config.getContext();
      t.is(context.name, pkgName);
      this.exec('echo ${name} ${repo.owner} ${repo.project} ${latestVersion} ${version}');
    }
    bump() {
      const repo = this.config.getContext('repo');
      t.is(repo.owner, owner);
      t.is(repo.project, project);
      t.is(repo.repository, `${owner}/${project}`);
      this.exec('echo ${name} ${repo.owner} ${repo.project} ${latestVersion} ${version}');
    }
    beforeRelease() {
      const context = this.config.getContext();
      t.is(context.name, pkgName);
      this.exec('echo ${name} ${repo.owner} ${repo.project} ${latestVersion} ${version} ${tagName}');
    }
    release() {
      const context = this.config.getContext();
      t.is(context.latestVersion, latestVersion);
      t.is(context.version, '1.0.1');
      this.exec('echo ${name} ${repo.owner} ${repo.project} ${latestVersion} ${version} ${tagName}');
    }
    afterRelease() {
      const context = this.config.getContext();
      t.is(context.tagName, '1.0.1');
      this.exec('echo ${name} ${repo.owner} ${repo.project} ${latestVersion} ${version} ${tagName}');
    }
  }
  const statics = { isEnabled: () => true, disablePlugin: () => null };
  const options = { '@global': true, '@noCallThru': true };
  const runTasks = proxyquire('../lib/tasks', {
    'my-plugin': Object.assign(MyPlugin, statics, options)
  });

  const container = getContainer({ plugins: { 'my-plugin': {} } });
  const exec = sinon.spy(container.shell, 'execFormattedCommand');

  await runTasks({}, container);

  const pluginExecArgs = exec.args
    .map(args => args[0])
    .filter(arg => typeof arg === 'string' && arg.startsWith('echo'));

  t.deepEqual(pluginExecArgs, [
    'echo false',
    `echo ${pkgName} ${owner} ${project} ${latestVersion} 1.0.1`,
    `echo ${pkgName} ${owner} ${project} ${latestVersion} 1.0.1`,
    `echo ${pkgName} ${owner} ${project} ${latestVersion} 1.0.1 1.0.1`,
    `echo ${pkgName} ${owner} ${project} ${latestVersion} 1.0.1 1.0.1`,
    `echo ${pkgName} ${owner} ${project} ${latestVersion} 1.0.1 1.0.1`
  ]);
});
