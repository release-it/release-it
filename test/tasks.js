const path = require('path');
const test = require('ava');
const sh = require('shelljs');
const proxyquire = require('proxyquire');
const _ = require('lodash');
const sinon = require('sinon');
const Log = require('../lib/log');
const Spinner = require('../lib/spinner');
const Config = require('../lib/config');
const runTasks = require('../lib/tasks');
const Plugin = require('../lib/plugin/Plugin');
const { mkTmpDir, gitAdd, getArgs } = require('./util/helpers');
const ShellStub = require('./stub/shell');
const {
  interceptUser: interceptGitLabUser,
  interceptCollaborator: interceptGitLabCollaborator,
  interceptPublish: interceptGitLabPublish,
  interceptAsset: interceptGitLabAsset
} = require('./stub/gitlab');
const {
  interceptAuthentication: interceptGitHubAuthentication,
  interceptCollaborator: interceptGitHubCollaborator,
  interceptCreate: interceptGitHubCreate,
  interceptAsset: interceptGitHubAsset
} = require('./stub/github');

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
  const npmArgs = getArgs(exec.args, 'npm');
  t.is(npmArgs[3], 'npm version 1.3.0 --no-git-tag-version');
  exec.restore();
});

test.serial('should ignore version in pkg.version and use git tag instead', async t => {
  gitAdd('{"name":"my-package","version":"0.0.0"}', 'package.json', 'Add package.json');
  sh.exec('git tag 1.1.1');
  gitAdd('line', 'file', 'More file');
  await runTasks({}, getContainer({ increment: 'minor', npm: { ignoreVersion: true } }));
  t.true(log.obtrusive.firstCall.args[0].includes('release my-package (1.1.1...1.2.0)'));
  t.regex(log.log.lastCall.args[0], /Done \(in [0-9]+s\.\)/);
  const { stdout } = sh.exec('git describe --tags --abbrev=0');
  t.is(stdout.trim(), '1.2.0');
});

test.serial('should release all the things (basic)', async t => {
  const { bare, target } = t.context;
  const project = path.basename(bare);
  const pkgName = path.basename(target);
  const owner = path.basename(path.dirname(bare));
  gitAdd(`{"name":"${pkgName}","version":"1.0.0"}`, 'package.json', 'Add package.json');
  sh.exec('git tag 1.0.0');
  const sha = gitAdd('line', 'file', 'More file');

  interceptGitHubAuthentication();
  interceptGitHubCollaborator({ owner, project });
  interceptGitHubCreate({
    owner,
    project,
    body: { tag_name: '1.0.1', name: 'Release 1.0.1', body: `* More file (${sha})`, prerelease: false }
  });

  const container = getContainer({
    github: { release: true, pushRepo: `https://github.com/${owner}/${project}` },
    npm: { name: pkgName }
  });
  const exec = sinon.spy(container.shell, 'exec');

  await runTasks({}, container);

  const npmArgs = getArgs(container.shell.exec.args, 'npm');

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
  const url = `https://gitlab.com/${owner}/${project}`;
  gitAdd(`{"name":"${pkgName}","version":"1.0.0"}`, 'package.json', 'Add package.json');
  sh.exec('git tag v1.0.0');
  const sha = gitAdd('line', 'file', 'More file');
  sh.exec('git push --follow-tags');

  interceptGitHubAuthentication();
  interceptGitHubCollaborator({ owner, project });
  interceptGitHubCreate({
    owner,
    project,
    body: {
      tag_name: 'v1.1.0-alpha.0',
      name: 'Release 1.1.0-alpha.0',
      body: `Notes for ${pkgName} [v1.1.0-alpha.0]: ${sha}`,
      prerelease: true
    }
  });
  interceptGitHubAsset({ owner, project, body: 'lineline' });

  interceptGitLabUser({ owner });
  interceptGitLabCollaborator({ owner, project });
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

  const exec = sinon.spy(container.shell, 'exec');

  await runTasks({}, container);

  const npmArgs = getArgs(container.shell.exec.args, 'npm');
  t.deepEqual(npmArgs, [
    'npm ping',
    'npm whoami',
    `npm show ${pkgName}@latest version`,
    'npm version 1.1.0-alpha.0 --no-git-tag-version',
    'npm publish . --tag alpha'
  ]);

  const { stdout: commitMessage } = sh.exec('git log --oneline --format=%B -n 1 HEAD');
  t.is(commitMessage.trim(), `Release 1.1.0-alpha.0 for ${pkgName} (from 1.0.0)`);

  const { stdout: tagName } = sh.exec('git describe --tags --abbrev=0');
  t.is(tagName.trim(), 'v1.1.0-alpha.0');

  const { stdout: tagAnnotation } = sh.exec('git for-each-ref refs/tags/v1.1.0-alpha.0 --format="%(contents)"');
  t.is(tagAnnotation.trim(), `${owner} ${owner}/${project} ${project}`);

  t.true(log.obtrusive.firstCall.args[0].endsWith(`release ${pkgName} (1.0.0...1.1.0-alpha.0)`));
  t.true(log.log.firstCall.args[0].endsWith(`https://github.com/${owner}/${project}/releases/tag/v1.1.0-alpha.0`));
  t.true(log.log.secondCall.args[0].endsWith(`${project}/-/releases`));
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

  await runTasks({}, container);

  const npmArgs = getArgs(container.shell.exec.args, 'npm');
  t.deepEqual(npmArgs, [
    'npm ping',
    'npm whoami',
    `npm show ${pkgName}@latest version`,
    'npm version 2.0.0-0 --no-git-tag-version',
    'npm publish . --tag next'
  ]);

  const { stdout } = sh.exec('git describe --tags --abbrev=0');
  t.is(stdout.trim(), 'v2.0.0-0');
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

  await runTasks({}, container);

  const npmArgs = getArgs(container.shell.exec.args, 'npm');
  t.deepEqual(npmArgs, ['npm version 1.0.1 --no-git-tag-version']);
  t.true(log.obtrusive.firstCall.args[0].endsWith(`release ${pkgName} (1.0.0...1.0.1)`));
  t.is(log.warn.lastCall.args[0], 'Skip publish: package is private.');
  t.regex(log.log.firstCall.args[0], /Done \(in [0-9]+s\.\)/);

  exec.restore();
});

test.serial('should initially publish non-private scoped npm package privately', async t => {
  const { target } = t.context;
  const pkgName = path.basename(target);
  gitAdd(`{"name":"@scope/${pkgName}","version":"1.0.0"}`, 'package.json', 'Add package.json');

  const container = getContainer({ npm: { name: pkgName } });

  const exec = sinon.stub(container.shell, 'exec').callThrough();
  exec.withArgs(`npm show @scope/${pkgName}@latest version`).rejects();

  await runTasks({}, container);

  const npmArgs = getArgs(container.shell.exec.args, 'npm');
  t.is(npmArgs[4], 'npm publish . --tag latest');
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

  await runTasks({}, container);

  const npmArgs = getArgs(exec.args, 'npm');
  t.is(npmArgs[0], `npm ping --registry ${registry}`);
  t.is(npmArgs[1], `npm whoami --registry ${registry}`);
  t.true(container.log.log.firstCall.args[0].endsWith(`${registry}/package/${pkgName}`));

  exec.restore();
});

test.serial('should propagate errors', async t => {
  const config = {
    hooks: {
      'before:init': 'some-failing-command'
    }
  };
  const container = getContainer(config);

  await t.throwsAsync(runTasks({}, container), { message: /some-failing-command/ });

  t.is(log.error.callCount, 1);
});

{
  const myPlugin = sandbox.createStubInstance(Plugin);
  myPlugin.namespace = 'my-plugin';
  const MyPlugin = sandbox.stub().callsFake(() => myPlugin);
  const myLocalPlugin = sandbox.createStubInstance(Plugin);
  const MyLocalPlugin = sandbox.stub().callsFake(() => myLocalPlugin);
  const replacePlugin = sandbox.createStubInstance(Plugin);
  const ReplacePlugin = sandbox.stub().callsFake(() => replacePlugin);

  const statics = { isEnabled: () => true, disablePlugin: () => null };
  const options = { '@global': true, '@noCallThru': true };
  const runTasks = proxyquire('../lib/tasks', {
    'my-plugin': Object.assign(MyPlugin, statics, options),
    '/my/plugin': Object.assign(MyLocalPlugin, statics, options),
    'replace-plugin': Object.assign(ReplacePlugin, statics, options, {
      disablePlugin: () => ['version', 'git']
    })
  });

  test.serial('should run all hooks', async t => {
    gitAdd(`{"name":"hooked","version":"1.0.0"}`, 'package.json', 'Add package.json');
    const hooks = {};
    ['before', 'after'].forEach(prefix => {
      ['version', 'git', 'npm', 'my-plugin'].forEach(ns => {
        ['init', 'beforeBump', 'bump', 'beforeRelease', 'release', 'afterRelease'].forEach(lifecycle => {
          hooks[`${prefix}:${lifecycle}`] = `echo ${prefix}:${lifecycle}`;
          hooks[`${prefix}:${ns}:${lifecycle}`] = `echo ${prefix}:${ns}:${lifecycle}`;
        });
      });
    });
    const container = getContainer({ plugins: { 'my-plugin': {} }, hooks });
    const exec = sinon.spy(container.shell, 'execFormattedCommand');

    await runTasks({}, container);

    const commands = _.flatten(exec.args).filter(arg => typeof arg === 'string' && arg.startsWith('echo'));

    t.deepEqual(commands, [
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
      'echo before:version:release',
      'echo after:version:release',
      'echo before:git:release',
      'echo after:git:release',
      'echo before:npm:release',
      'echo after:npm:release',
      'echo before:my-plugin:release',
      'echo after:my-plugin:release',
      'echo after:release',
      'echo before:afterRelease',
      'echo before:version:afterRelease',
      'echo after:version:afterRelease',
      'echo before:git:afterRelease',
      'echo after:git:afterRelease',
      'echo before:npm:afterRelease',
      'echo after:npm:afterRelease',
      'echo before:my-plugin:afterRelease',
      'echo after:my-plugin:afterRelease',
      'echo after:afterRelease'
    ]);

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

    await runTasks({}, container);

    t.is(MyPlugin.firstCall.args[0].namespace, 'my-plugin');
    t.deepEqual(MyPlugin.firstCall.args[0].options['my-plugin'], { name: 'foo' });
    t.is(MyLocalPlugin.firstCall.args[0].namespace, 'named-plugin');
    t.deepEqual(MyLocalPlugin.firstCall.args[0].options['named-plugin'], { name: 'bar' });

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
      t.is(myPlugin[method].callCount, 1);
      t.is(myLocalPlugin[method].callCount, 1);
    });

    const incrementBase = { latestVersion: '0.0.0', increment: 'patch', isPreRelease: false, preReleaseId: undefined };
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
      latestVersion: undefined,
      version: undefined
    });
  });
}
