const path = require('path');
const test = require('ava');
const sh = require('shelljs');
const {
  interceptDraft: interceptGitHubDraft,
  interceptPublish: interceptGitHubPublish,
  interceptAsset: interceptGitHubAsset
} = require('./stub/github');
const { interceptPublish: interceptGitLabPublish, interceptAsset: interceptGitLabAsset } = require('./stub/gitlab');
const proxyquire = require('proxyquire');
const _ = require('lodash');
const Log = require('../lib/log');
const Spinner = require('../lib/spinner');
const Config = require('../lib/config');
const { mkTmpDir, gitAdd } = require('./util/helpers');
const ShellStub = require('./stub/shell');
const sinon = require('sinon');
const runTasks = require('../lib/tasks');
const Plugin = require('../lib/plugin/Plugin');

const noop = Promise.resolve();

const sandbox = sinon.createSandbox();

const testConfig = {
  config: false,
  'non-interactive': true,
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

const getNpmArgs = args => args.filter(args => args[0].startsWith('npm ')).map(args => args[0].trim());

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

test.serial('should run tasks without throwing errors', async t => {
  sh.mv('.git', 'foo');
  const { name, latestVersion, version } = await runTasks({}, getContainer());
  t.true(log.obtrusive.firstCall.args[0].includes(`release ${name} (${latestVersion}...${version})`));
  t.regex(log.log.lastCall.args[0], /Done \(in [0-9]+s\.\)/);
});

test.serial('should run tasks without package.json', async t => {
  sh.exec('git tag 1.0.0');
  gitAdd('line', 'file', 'Add file');
  const { name } = await runTasks({}, getContainer({ increment: 'major', git: { commit: false } }));
  t.true(log.obtrusive.firstCall.args[0].includes(`release ${name} (1.0.0...2.0.0)`));
  t.regex(log.log.lastCall.args[0], /Done \(in [0-9]+s\.\)/);
  t.is(log.warn.callCount, 0);
  {
    const { stdout } = sh.exec('git describe --tags --abbrev=0');
    t.is(stdout.trim(), '2.0.0');
  }
});

test.serial('should disable plugins', async t => {
  gitAdd('{"name":"my-package","version":"1.2.3"}', 'package.json', 'Add package.json');
  sh.exec('git tag 1.2.3');
  gitAdd('line', 'file', 'Add file');
  const container = getContainer({ increment: 'minor', git: false, npm: false });
  const { latestVersion, version } = await runTasks({}, container);
  t.is(latestVersion, '0.0.0');
  t.is(version, '0.1.0');
  t.regex(log.log.lastCall.args[0], /Done \(in [0-9]+s\.\)/);
});

test.serial('should run tasks with minimal config and without any warnings/errors', async t => {
  gitAdd('{"name":"my-package","version":"1.2.3"}', 'package.json', 'Add package.json');
  sh.exec('git tag 1.2.3');
  gitAdd('line', 'file', 'More file');
  await runTasks({}, getContainer({ increment: 'patch' }));
  t.true(log.obtrusive.firstCall.args[0].includes('release my-package (1.2.3...1.2.4)'));
  t.regex(log.log.lastCall.args[0], /Done \(in [0-9]+s\.\)/);
  const { stdout } = sh.exec('git describe --tags --abbrev=0');
  t.is(stdout.trim(), '1.2.4');
});

test.serial('should use pkg.version', async t => {
  gitAdd('{"name":"my-package","version":"1.2.3"}', 'package.json', 'Add package.json');
  await runTasks({}, getContainer({ increment: 'minor' }));
  t.true(log.obtrusive.firstCall.args[0].includes('release my-package (1.2.3...1.3.0)'));
  t.regex(log.log.lastCall.args[0], /Done \(in [0-9]+s\.\)/);
  const { stdout } = sh.exec('git describe --tags --abbrev=0');
  t.is(stdout.trim(), '1.3.0');
});

test.serial('should use pkg.version (in sub dir) w/o tagging repo', async t => {
  gitAdd('{"name":"root-package","version":"1.0.0"}', 'package.json', 'Add package.json');
  sh.exec('git tag 1.0.0');
  sh.mkdir('my-package');
  sh.pushd('-q', 'my-package');
  gitAdd('{"name":"my-package","version":"1.2.3"}', 'package.json', 'Add package.json');
  const container = getContainer({ increment: 'minor', git: { tag: false } });
  const exec = sinon.spy(container.shell, 'exec');
  await runTasks({}, container);
  t.true(log.obtrusive.firstCall.args[0].endsWith('release my-package (1.2.3...1.3.0)'));
  t.regex(log.log.lastCall.args[0], /Done \(in [0-9]+s\.\)/);
  const { stdout } = sh.exec('git describe --tags --abbrev=0');
  t.is(stdout.trim(), '1.0.0');
  const npmArgs = getNpmArgs(exec.args);
  t.is(npmArgs[3], 'npm version 1.3.0 --no-git-tag-version');
  exec.restore();
});

const fooPlugin = sandbox.createStubInstance(Plugin);
const FooPlugin = sandbox.stub().callsFake(() => fooPlugin);
const barPlugin = sandbox.createStubInstance(Plugin);
const BarPlugin = sandbox.stub().callsFake(() => barPlugin);
const replacePlugin = sandbox.createStubInstance(Plugin);
const ReplacePlugin = sandbox.stub().callsFake(() => replacePlugin);

{
  const statics = { isEnabled: () => true, disablePlugin: () => null };
  const runTasks = proxyquire('../lib/tasks', {
    'my-plugin': Object.assign(FooPlugin, statics, { '@global': true, '@noCallThru': true }),
    '/my/plugin': Object.assign(BarPlugin, statics, { '@global': true, '@noCallThru': true }),
    'replace-plugin': Object.assign(ReplacePlugin, statics, {
      disablePlugin: () => ['version', 'git'],
      '@global': true,
      '@noCallThru': true
    })
  });

  const tasks = (options, ...args) => runTasks(Object.assign({}, testConfig, options), ...args);

  test.serial('should release all the things (basic)', async t => {
    const { bare, target } = t.context;
    const project = path.basename(bare);
    const pkgName = path.basename(target);
    const owner = path.basename(path.dirname(bare));
    gitAdd(`{"name":"${pkgName}","version":"1.0.0"}`, 'package.json', 'Add package.json');
    sh.exec('git tag 1.0.0');
    const sha = gitAdd('line', 'file', 'More file');

    interceptGitHubDraft({
      owner,
      project,
      body: { tag_name: '1.0.1', name: 'Release 1.0.1', body: `* More file (${sha})`, prerelease: false, draft: true }
    });
    interceptGitHubPublish({ owner, project, body: { draft: false, tag_name: '1.0.1' } });

    const container = getContainer({
      github: { release: true, remoteUrl: `https://github.com/${owner}/${project}` },
      npm: { name: pkgName }
    });
    const exec = sinon.spy(container.shell, 'exec');

    await tasks({}, container);

    const npmArgs = getNpmArgs(container.shell.exec.args);

    t.deepEqual(npmArgs, [
      'npm ping',
      'npm whoami',
      `npm show ${pkgName}@latest version`,
      'npm version 1.0.1 --no-git-tag-version',
      'npm publish . --tag latest'
    ]);

    t.true(log.obtrusive.firstCall.args[0].endsWith(`release ${pkgName} (1.0.0...1.0.1)`));
    t.true(log.log.firstCall.args[0].endsWith(`https://github.com/${owner}/${project}/releases/tag/1.0.1`));
    t.true(log.log.secondCall.args[0].endsWith(`https://www.npmjs.com/package/${pkgName}`));

    exec.restore();
  });

  test.serial('should release all the things (pre-release, github, gitlab)', async t => {
    const { bare, target } = t.context;
    const project = path.basename(bare);
    const pkgName = path.basename(target);
    const owner = path.basename(path.dirname(bare));
    gitAdd(`{"name":"${pkgName}","version":"1.0.0"}`, 'package.json', 'Add package.json');
    sh.exec('git tag v1.0.0');
    const sha = gitAdd('line', 'file', 'More file');
    sh.exec('git push --follow-tags');

    interceptGitHubDraft({
      owner,
      project,
      body: {
        tag_name: 'v1.1.0-alpha.0',
        name: 'Release 1.1.0-alpha.0',
        body: `Notes for ${pkgName} [v1.1.0-alpha.0]: ${sha}`,
        prerelease: true,
        draft: true
      }
    });
    interceptGitHubAsset({ owner, project, body: 'lineline' });
    interceptGitHubPublish({ owner, project, body: { draft: false, tag_name: 'v1.1.0-alpha.0' } });

    interceptGitLabAsset({ owner, project });
    interceptGitLabPublish({
      owner,
      project,
      body: {
        name: 'Release 1.1.0-alpha.0',
        tag_name: 'v1.1.0-alpha.0',
        description: `Notes for ${pkgName}: ${sha}`,
        assets: {
          links: [
            {
              name: 'file',
              url: `https://gitlab.com/${owner}/${project}/uploads/7e8bec1fe27cc46a4bc6a91b9e82a07c/file`
            }
          ]
        }
      }
    });

    const container = getContainer({
      increment: 'minor',
      preRelease: 'alpha',
      git: { changelog: 'git log --pretty=format:%h ${latestTag}...HEAD', tagName: 'v${version}' },
      github: {
        release: true,
        remoteUrl: `https://github.com/${owner}/${project}`,
        releaseNotes: 'echo Notes for ${name} [v${version}]: ${changelog}',
        assets: ['file']
      },
      gitlab: {
        release: true,
        remoteUrl: `https://gitlab.com/${owner}/${project}`,
        releaseNotes: 'echo Notes for ${name}: ${changelog}',
        assets: ['file']
      },
      npm: { name: pkgName }
    });

    const exec = sinon.spy(container.shell, 'exec');

    await tasks({}, container);

    const npmArgs = getNpmArgs(container.shell.exec.args);
    t.deepEqual(npmArgs, [
      'npm ping',
      'npm whoami',
      `npm show ${pkgName}@latest version`,
      'npm version 1.1.0-alpha.0 --no-git-tag-version',
      'npm publish . --tag alpha'
    ]);

    const { stdout } = sh.exec('git describe --tags --abbrev=0');
    t.is(stdout.trim(), 'v1.1.0-alpha.0');

    t.true(log.obtrusive.firstCall.args[0].endsWith(`release ${pkgName} (1.0.0...1.1.0-alpha.0)`));
    t.true(log.log.firstCall.args[0].endsWith(`https://github.com/${owner}/${project}/releases/tag/v1.1.0-alpha.0`));
    t.true(log.log.secondCall.args[0].endsWith(`${project}/releases`));
    t.true(log.log.thirdCall.args[0].endsWith(`https://www.npmjs.com/package/${pkgName}`));
    t.regex(log.log.lastCall.args[0], /Done \(in [0-9]+s\.\)/);

    exec.restore();
  });

  test.serial('should publish pre-release without pre-id with different npm.tag', async t => {
    const { target } = t.context;
    const pkgName = path.basename(target);
    gitAdd(`{"name":"${pkgName}","version":"1.0.0"}`, 'package.json', 'Add package.json');
    sh.exec('git tag v1.0.0');

    const container = getContainer({ increment: 'major', preRelease: true, npm: { name: pkgName, tag: 'next' } });
    const exec = sinon.spy(container.shell, 'exec');

    await tasks({}, container);

    const npmArgs = getNpmArgs(container.shell.exec.args);
    t.deepEqual(npmArgs, [
      'npm ping',
      'npm whoami',
      `npm show ${pkgName}@latest version`,
      'npm version 2.0.0-0 --no-git-tag-version',
      'npm publish . --tag next'
    ]);

    const { stdout } = sh.exec('git describe --tags --abbrev=0');
    t.is(stdout.trim(), '2.0.0-0');
    t.true(log.obtrusive.firstCall.args[0].endsWith(`release ${pkgName} (1.0.0...2.0.0-0)`));
    t.true(log.log.firstCall.args[0].endsWith(`https://www.npmjs.com/package/${pkgName}`));
    t.regex(log.log.lastCall.args[0], /Done \(in [0-9]+s\.\)/);

    exec.restore();
  });

  test.serial('should handle private package correctly, bump lockfile', async t => {
    const { target } = t.context;
    const pkgName = path.basename(target);
    gitAdd(`{"name":"${pkgName}","version":"1.0.0","private":true}`, 'package.json', 'Add package.json');
    gitAdd(`{"name":"${pkgName}","version":"1.0.0","private":true}`, 'package-lock.json', 'Add package-lock.json');

    const container = getContainer({ npm: { name: pkgName, private: true } });
    const exec = sinon.spy(container.shell, 'exec');

    await tasks({}, container);

    const npmArgs = getNpmArgs(container.shell.exec.args);
    t.deepEqual(npmArgs, ['npm version 1.0.1 --no-git-tag-version']);
    t.true(log.obtrusive.firstCall.args[0].endsWith(`release ${pkgName} (1.0.0...1.0.1)`));
    t.is(log.warn.lastCall.args[0], 'Skip publish: package is private.');
    t.regex(log.log.firstCall.args[0], /Done \(in [0-9]+s\.\)/);

    exec.restore();
  });

  test.serial('should initially publish non-private scoped npm package publicly', async t => {
    const { target } = t.context;
    const pkgName = path.basename(target);
    gitAdd(`{"name":"@scope/${pkgName}","version":"1.0.0"}`, 'package.json', 'Add package.json');

    const container = getContainer({ npm: { name: pkgName } });

    const exec = sinon.stub(container.shell, 'exec').callThrough();
    exec.withArgs(`npm show @scope/${pkgName}@latest version`).rejects();

    await tasks({}, container);

    const npmArgs = getNpmArgs(container.shell.exec.args);
    t.is(npmArgs[4], 'npm publish . --tag latest --access public');
    exec.restore();
  });

  test.serial('should run all scripts', async t => {
    const { bare } = t.context;
    const scripts = {
      beforeStart: 'echo beforeStart ${name} ${repo.project}',
      beforeBump: 'echo beforeBump ${name}',
      beforeStage: 'echo beforeStage ${name}',
      afterRelease: 'echo afterRelease ${name} ${repo.project}'
    };
    const container = getContainer({ increment: 'patch', scripts });
    const exec = sinon.spy(container.shell, '_exec');
    const { name } = await tasks({}, container);
    const commands = _.flatten(exec.args).filter(arg => typeof arg === 'string');
    const scriptsArray = _.values(scripts)
      .map(script => script.replace('${name}', name))
      .map(script => script.replace('${repo.project}', path.basename(bare)));
    const filtered = commands.filter(command => scriptsArray.includes(command));
    t.deepEqual(filtered, scriptsArray);
    exec.restore();
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

    const container = getContainer();

    const exec = sinon.spy(container.shell, 'exec');

    await tasks({}, container);

    const npmArgs = getNpmArgs(exec.args);
    t.is(npmArgs[0], `npm ping --registry ${registry}`);
    t.is(npmArgs[1], `npm whoami --registry ${registry}`);
    t.true(container.log.log.firstCall.args[0].endsWith(`${registry}/package/${pkgName}`));

    exec.restore();
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
    await tasks({}, container);

    t.deepEqual(FooPlugin.firstCall.args[0].namespace, 'my-plugin');
    t.deepEqual(FooPlugin.firstCall.args[0].options['my-plugin'], { name: 'foo' });
    t.deepEqual(BarPlugin.firstCall.args[0].namespace, 'named-plugin');
    t.deepEqual(BarPlugin.firstCall.args[0].options['named-plugin'], { name: 'bar' });

    [
      'init',
      'getName',
      'getLatestVersion',
      'getIncrementedVersionCI',
      'beforeBump',
      'bump',
      'beforeRelease',
      'release',
      'afterRelease'
    ].forEach(method => {
      t.is(fooPlugin[method].callCount, 1);
      t.is(barPlugin[method].callCount, 1);
    });

    const incrementBase = { latestVersion: '0.0.0', increment: 'patch', isPreRelease: false, preReleaseId: undefined };
    t.deepEqual(fooPlugin.getIncrementedVersionCI.firstCall.args[0], incrementBase);
    t.deepEqual(barPlugin.getIncrementedVersionCI.firstCall.args[0], incrementBase);
    t.is(fooPlugin.bump.firstCall.args[0], '0.0.1');
    t.is(barPlugin.bump.firstCall.args[0], '0.0.1');
  });

  test.serial('should disable core plugins', async t => {
    const config = {
      plugins: {
        'replace-plugin': {}
      }
    };
    const container = getContainer(config);
    const result = await tasks({}, container);
    t.deepEqual(result, {
      changelog: undefined,
      name: undefined,
      latestVersion: undefined,
      version: undefined
    });
  });

  test.serial('should propagate errors', async t => {
    const config = {
      scripts: {
        beforeStart: 'some-failing-command'
      }
    };
    const container = getContainer(config);
    await t.throwsAsync(tasks({}, container), /some-failing-command/);
    t.is(log.error.callCount, 1);
  });
}
