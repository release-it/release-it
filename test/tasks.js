const test = require('tape');
const shell = require('shelljs');
const proxyquire = require('proxyquire');
const { Config } = require('../lib/config');
const { run } = require('../lib/shell');
const {
  GitRepoError,
  GitRemoteUrlError,
  GitCleanWorkingDirError,
  GitUpstreamError,
  GithubTokenError,
  VersionNotFoundError
} = require('../lib/errors');

const getMock = config =>
  proxyquire('../lib/tasks', {
    './config': { config }
  });

const tmp = 'test/resources/tmp';

test('should throw when not a Git repository', async t => {
  const tasks = getMock(new Config());
  shell.pushd('-q', '..');
  await t.shouldBailOut(tasks(), GitRepoError, /Not a git repository/);
  shell.popd('-q');
  t.end();
});

test('should throw if there is no remote Git url', async t => {
  const tasks = getMock(new Config());
  shell.mkdir(tmp);
  shell.pushd('-q', tmp);
  await run('git init');
  await run('!touch file1');
  await run('git add file1');
  await run('git commit -am "Add file1"');
  await t.shouldBailOut(tasks(), GitRemoteUrlError, /Could not get remote Git url/);
  shell.popd('-q');
  shell.rm('-rf', tmp);
  t.end();
});

test('should throw if working dir is not clean', async t => {
  const tasks = getMock(new Config());
  shell.rm('-rf', tmp);
  shell.mkdir(tmp);
  shell.pushd('-q', tmp);
  await run('git init');
  await run('!touch file1');
  await run('git remote add origin foo');
  await run('git add file1');
  await t.shouldBailOut(tasks(), GitCleanWorkingDirError, /Working dir must be clean/);
  shell.popd('-q');
  shell.rm('-rf', tmp);
  t.end();
});

test('should throw if no upstream is configured for current branch', async t => {
  const tasks = getMock(
    new Config({
      requireUpstream: true
    })
  );
  shell.rm('-rf', tmp);
  shell.mkdir(tmp);
  shell.pushd('-q', tmp);
  await run('git init');
  await run('!touch file1');
  await run('git remote add origin foo');
  await run('git add file1');
  await run('git commit -am "Add file1"');
  await t.shouldBailOut(tasks(), GitUpstreamError, /No upstream configured for current branch/);
  shell.popd('-q');
  shell.rm('-rf', tmp);
  t.end();
});

test('should throw if no GitHub token environment variable is set', async t => {
  const tasks = getMock(
    new Config({
      requireUpstream: false,
      github: {
        release: true,
        tokenRef: 'GITHUB_FOO'
      }
    })
  );
  shell.rm('-rf', tmp);
  shell.mkdir(tmp);
  shell.pushd('-q', tmp);
  await run('git init');
  await run('!touch file1');
  await run('git remote add origin foo');
  await run('git add file1');
  await run('git commit -am "Add file1"');
  await t.shouldBailOut(tasks(), GithubTokenError, /Environment variable "GITHUB_FOO" is required for GitHub releases/);
  shell.popd('-q');
  shell.rm('-rf', tmp);
  t.end();
});

test('should throw if invalid increment value is provided (in non-interactive mode)', async t => {
  const tasks = getMock(
    new Config({
      increment: 'mini',
      'non-interactive': true,
      requireUpstream: false,
      github: {
        release: false
      }
    })
  );
  shell.rm('-rf', tmp);
  shell.mkdir(tmp);
  shell.pushd('-q', tmp);
  await run('git init');
  await run('!touch file1');
  await run('git remote add origin foo');
  await run('git add file1');
  await run('git commit -am "Add file1"');
  await t.shouldBailOut(tasks(), VersionNotFoundError, /no or an invalid version is provided/);
  shell.popd('-q');
  shell.rm('-rf', tmp);
  t.end();
});
