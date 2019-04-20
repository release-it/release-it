const path = require('path');
const test = require('ava');
const sh = require('shelljs');
const proxyquire = require('proxyquire');
const _ = require('lodash');
const debug = require('debug');
const Log = require('../../lib/log');
const Spinner = require('../../lib/spinner');
const { gitAdd, readJSON } = require('../util/index');
const uuid = require('uuid/v4');
const GitHubApi = require('@octokit/rest');
const githubRequest = require('../stub/github.request');
const got = require('../stub/got');
const Shell = require('../../lib/shell');
const sinon = require('sinon');
const runTasks = require('../../lib/tasks');

const cwd = process.cwd();

const sandbox = sinon.createSandbox();

const githubRequestStub = sandbox.stub().callsFake(githubRequest);
const githubApi = new GitHubApi();
githubApi.hook.wrap('request', githubRequestStub);
const GitHubApiStub = sandbox.stub().returns(githubApi);

const gotStub = got();

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

{
  const runTasks = proxyquire('../../lib/tasks', {
    '@octokit/rest': Object.assign(GitHubApiStub, { '@global': true }),
    got: Object.assign(gotStub, { '@global': true }),
    './shell': Object.assign(ShellStub, { '@global': true })
  });

  const tasks = (options, ...args) => runTasks(Object.assign({}, testConfig, options), ...args);

  test.serial('should release all the things (basic)', async t => {
    const { bare, target } = t.context;
    const repoName = path.basename(bare);
    const pkgName = path.basename(target);
    const owner = 'tmp';
    gitAdd(`{"name":"${pkgName}","version":"1.0.0"}`, 'package.json', 'Add package.json');
    sh.exec('git tag 1.0.0');
    gitAdd('line', 'file', 'More file');
    await tasks({ github: { release: true }, npm: { name: pkgName, publish: true } }, stubs);
    const githubReleaseArg = githubRequestStub.firstCall.lastArg;
    t.is(githubRequestStub.callCount, 1);
    t.is(githubReleaseArg.url, '/repos/:owner/:repo/releases');
    t.is(githubReleaseArg.owner, owner);
    t.is(githubReleaseArg.repo, repoName);
    t.is(githubReleaseArg.tag_name, '1.0.1');
    t.is(githubReleaseArg.name, 'Release 1.0.1');
    t.true(githubReleaseArg.body.startsWith('* More file'));
    t.is(githubReleaseArg.prerelease, false);
    t.is(githubReleaseArg.draft, false);

    t.is(npmStub.callCount, 4);
    t.is(npmStub.firstCall.args[0], 'npm ping');
    t.is(npmStub.secondCall.args[0], 'npm whoami');
    t.is(npmStub.thirdCall.args[0], `npm show ${pkgName}@latest version`);
    t.is(npmStub.args[3][0], 'npm publish . --tag latest');

    t.true(log.obtrusive.firstCall.args[0].endsWith(`release ${pkgName} (1.0.0...1.0.1)`));
    t.true(log.log.firstCall.args[0].endsWith(`https://github.com/${owner}/${repoName}/releases/tag/1.0.1`));
    t.true(log.log.secondCall.args[0].endsWith(`https://www.npmjs.com/package/${pkgName}`));
  });

  test.serial('should release all the things (pre-release, github, gitlab)', async t => {
    const { bare, target } = t.context;
    const repoName = path.basename(bare);
    const owner = 'tmp';
    const pkgName = path.basename(target);
    gitAdd(`{"name":"${pkgName}","version":"1.0.0"}`, 'package.json', 'Add package.json');
    sh.exec('git tag v1.0.0');
    gitAdd('line', 'file', 'More file');
    sh.exec('git push --follow-tags');
    await tasks(
      {
        increment: 'minor',
        preRelease: 'alpha',
        git: { tagName: 'v${version}' },
        github: {
          release: true,
          releaseNotes: 'echo "Notes for ${name} (v${version}): ${changelog}"',
          assets: ['file']
        },
        gitlab: {
          release: true,
          releaseNotes: 'echo "Notes for ${name}: ${changelog}"',
          assets: ['file']
        },
        npm: { name: pkgName }
      },
      stubs
    );

    t.is(githubRequestStub.callCount, 2);

    const githubReleaseArg = githubRequestStub.firstCall.lastArg;
    t.is(githubReleaseArg.url, '/repos/:owner/:repo/releases');
    t.is(githubReleaseArg.owner, owner);
    t.is(githubReleaseArg.repo, repoName);
    t.is(githubReleaseArg.tag_name, 'v1.1.0-alpha.0');
    t.is(githubReleaseArg.name, 'Release 1.1.0-alpha.0');
    t.regex(githubReleaseArg.body, RegExp(`Notes for ${pkgName} \\(v1.1.0-alpha.0\\): \\* More file`));
    t.is(githubReleaseArg.prerelease, true);
    t.is(githubReleaseArg.draft, false);

    const githubAssetsArg = githubRequestStub.secondCall.lastArg;
    const { id } = githubRequestStub.firstCall.returnValue.data;
    t.true(githubAssetsArg.url.endsWith(`/repos/${owner}/${repoName}/releases/${id}/assets{?name,label}`));
    t.is(githubAssetsArg.name, 'file');

    t.true(gotStub.post.firstCall.args[0].endsWith(`/projects/${owner}%2F${repoName}/uploads`));
    t.true(gotStub.post.secondCall.args[0].endsWith(`/projects/${owner}%2F${repoName}/releases`));
    t.regex(gotStub.post.secondCall.args[1].body.description, RegExp(`Notes for ${pkgName}: \\* More file`));

    t.is(npmStub.callCount, 4);
    t.is(npmStub.lastCall.args[0], 'npm publish . --tag alpha');

    const { stdout } = sh.exec('git describe --tags --abbrev=0');
    t.is(stdout.trim(), 'v1.1.0-alpha.0');

    t.true(log.obtrusive.firstCall.args[0].endsWith(`release ${pkgName} (1.0.0...1.1.0-alpha.0)`));
    t.true(log.log.firstCall.args[0].endsWith(`https://github.com/${owner}/${repoName}/releases/tag/v1.1.0-alpha.0`));
    t.true(log.log.secondCall.args[0].endsWith(`${repoName}/releases`));
    t.true(log.log.thirdCall.args[0].endsWith(`https://www.npmjs.com/package/${pkgName}`));
    t.regex(log.log.lastCall.args[0], /Done \(in [0-9]+s\.\)/);
  });
}
