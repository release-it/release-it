const path = require('path');
const test = require('ava');
const sh = require('shelljs');
const proxyquire = require('proxyquire');
const _ = require('lodash');
const debug = require('debug');
const Log = require('../lib/log');
const Spinner = require('../lib/spinner');
const { gitAdd, readJSON } = require('./util/index');
const uuid = require('uuid/v4');
const GitHubApi = require('@octokit/rest');
const githubRequest = require('./stub/github.request');
const got = require('./stub/got');
const Shell = require('../lib/shell');
const sinon = require('sinon');
const runTasks = require('../lib/tasks');

const cwd = process.cwd();
const noop = Promise.resolve();

const sandbox = sinon.createSandbox();

const githubRequestStub = sandbox.stub().callsFake(githubRequest);
const githubApi = new GitHubApi();
githubApi.hook.wrap('request', githubRequestStub);
const GitHubApiStub = sandbox.stub().returns(githubApi);

const gotStub = got();

const npmStub = sandbox.stub().resolves();
const log = sandbox.createStubInstance(Log);
const spinner = sandbox.createStubInstance(Spinner);
spinner.show.callsFake(({ enabled = true, task }) => (enabled ? task() : noop));
const stubs = { log, spinner };

class ShellStub extends Shell {
  run(command) {
    if (/^npm /.test(command)) {
      debug('release-it:npm')(...arguments);
      return npmStub(...arguments);
    }
    return super.run(...arguments);
  }
}

const testConfig = {
  config: false,
  'non-interactive': true,
  'disable-metrics': true
};

const tasks = (options, ...args) => runTasks(Object.assign({}, testConfig, options), ...args);

test.serial.beforeEach(t => {
  const bare = path.resolve(cwd, 'tmp', uuid());
  const target = path.resolve(cwd, 'tmp', uuid());
  sh.pushd('-q', `${cwd}/tmp`);
  sh.exec(`git init --bare ${bare}`);
  sh.exec(`git clone ${bare} ${target}`);
  sh.pushd('-q', target);
  gitAdd('line', 'file', 'Add file');
  t.context = { bare, target };
});

test.serial.afterEach(() => {
  sh.pushd('-q', cwd);
  sandbox.resetHistory();
});

test.serial('should run tasks without throwing errors', async t => {
  const { name, latestVersion, version } = await tasks(
    { increment: 'patch', pkgFiles: null, manifest: false, npm: { publish: false } },
    stubs
  );
  t.true(log.obtrusive.firstCall.args[0].includes(`release ${name} (${latestVersion}...${version})`));
  t.regex(log.log.lastCall.args[0], /Done \(in [0-9]+s\.\)/);
});

test.serial('should run tasks with minimal config and without any warnings/errors', async t => {
  gitAdd('{"name":"my-package","version":"1.2.3"}', 'package.json', 'Add package.json');
  sh.exec('git tag 1.2.3');
  gitAdd('line', 'file', 'More file');
  await tasks({ increment: 'patch', npm: { publish: false } }, stubs);
  t.true(log.obtrusive.firstCall.args[0].includes('release my-package (1.2.3...1.2.4)'));
  t.regex(log.log.lastCall.args[0], /Done \(in [0-9]+s\.\)/);
  const pkg = await readJSON('package.json');
  t.is(pkg.version, '1.2.4');
  {
    const { stdout } = sh.exec('git describe --tags --abbrev=0');
    t.is(stdout.trim(), '1.2.4');
  }
});

test.serial('should use pkg.version if no git tag', async t => {
  gitAdd('{"name":"my-package","version":"1.2.3"}', 'package.json', 'Add package.json');
  await tasks({ increment: 'minor', npm: { publish: false } }, stubs);
  t.true(log.obtrusive.firstCall.args[0].includes('release my-package (1.2.3...1.3.0)'));
  t.regex(log.log.lastCall.args[0], /Done \(in [0-9]+s\.\)/);
  const pkg = await readJSON('package.json');
  t.is(pkg.version, '1.3.0');
  {
    const { stdout } = sh.exec('git describe --tags --abbrev=0');
    t.is(stdout.trim(), '1.3.0');
  }
});

test.serial('should use pkg.version (in sub dir) w/o tagging repo', async t => {
  gitAdd('{"name":"root-package","version":"1.0.0"}', 'package.json', 'Add package.json');
  sh.exec('git tag 1.0.0');
  sh.mkdir('my-package');
  sh.pushd('-q', 'my-package');
  gitAdd('{"name":"my-package","version":"1.2.3"}', 'package.json', 'Add package.json');
  await tasks({ increment: 'minor', git: { tag: false }, npm: { publish: false } }, stubs);
  t.true(log.obtrusive.firstCall.args[0].endsWith('release my-package (1.2.3...1.3.0)'));
  t.regex(log.log.lastCall.args[0], /Done \(in [0-9]+s\.\)/);
  const pkg = await readJSON('package.json');
  t.is(pkg.version, '1.3.0');
  sh.popd('-q');
  {
    const { stdout } = sh.exec('git describe --tags --abbrev=0');
    t.is(stdout.trim(), '1.0.0');
    const pkg = await readJSON('package.json');
    t.is(pkg.version, '1.0.0');
  }
});

test.serial('should run tasks without package.json', async t => {
  sh.exec('git tag 1.0.0');
  const { name } = await tasks({ increment: 'major', npm: { publish: false } }, stubs);
  t.true(log.obtrusive.firstCall.args[0].includes(`release ${name} (1.0.0...2.0.0)`));
  t.regex(log.log.lastCall.args[0], /Done \(in [0-9]+s\.\)/);
  const warnings = _.flatten(log.warn.args);
  t.true(warnings.includes('Could not bump package.json'));
  t.true(warnings.includes('Could not stage package.json'));
  {
    const { stdout } = sh.exec('git describe --tags --abbrev=0');
    t.is(stdout.trim(), '2.0.0');
  }
});

{
  const runTasks = proxyquire('../lib/tasks', {
    '@octokit/rest': Object.assign(GitHubApiStub, { '@global': true }),
    got: Object.assign(gotStub, { '@global': true }),
    './shell': Object.assign(ShellStub, { '@global': true })
  });

  const tasks = (options, ...args) => runTasks(Object.assign({}, testConfig, options), ...args);

  test.serial('should publish pre-release without pre-id with different npm.tag', async t => {
    const { target } = t.context;
    const pkgName = path.basename(target);
    gitAdd(`{"name":"${pkgName}","version":"1.0.0"}`, 'package.json', 'Add package.json');
    sh.exec('git tag v1.0.0');
    await tasks({ increment: 'major', preRelease: true, npm: { name: pkgName, tag: 'next' } }, stubs);
    t.is(npmStub.callCount, 4);
    t.is(npmStub.lastCall.args[0], 'npm publish . --tag next');
    const { stdout } = sh.exec('git describe --tags --abbrev=0');
    t.is(stdout.trim(), '2.0.0-0');
    t.true(log.obtrusive.firstCall.args[0].endsWith(`release ${pkgName} (1.0.0...2.0.0-0)`));
    t.true(log.log.firstCall.args[0].endsWith(`https://www.npmjs.com/package/${pkgName}`));
    t.regex(log.log.lastCall.args[0], /Done \(in [0-9]+s\.\)/);
  });

  test.serial('should run all scripts', async t => {
    const { bare } = t.context;
    const spy = sinon.spy(ShellStub.prototype, 'run');
    const scripts = {
      beforeStart: 'echo beforeStart ${name} ${repo.project}',
      beforeBump: 'echo beforeBump ${name}',
      beforeStage: 'echo beforeStage ${name}',
      afterRelease: 'echo afterRelease ${name} ${repo.project}'
    };
    const { name } = await tasks({ increment: 'patch', pkgFiles: null, manifest: false, scripts }, stubs);
    const commands = _.flatten(spy.args);
    const scriptsArray = _.values(scripts)
      .map(script => script.replace('${name}', name))
      .map(script => script.replace('${repo.project}', path.basename(bare)));
    const filtered = commands.filter(command => scriptsArray.includes(command));
    t.deepEqual(filtered, scriptsArray);
    spy.restore();
  });

  test.serial('should use pkg.publishConfig.registry', async t => {
    const { target } = t.context;
    const pkgName = path.basename(target);
    const registry = 'https://my-registry.com';

    gitAdd(
      JSON.stringify({
        name: pkgName,
        version: '1.2.3',
        publishConfig: { registry }
      }),
      'package.json',
      'Add package.json'
    );
    await tasks({ npm: { name: pkgName } }, stubs);

    t.is(npmStub.firstCall.args[0], `npm ping --registry ${registry}`);
    t.is(npmStub.secondCall.args[0], `npm whoami --registry ${registry}`);
    t.true(log.log.firstCall.args[0].endsWith(`${registry}/package/${pkgName}`));
  });
}
