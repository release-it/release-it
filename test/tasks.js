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
  InvalidVersionError,
  DistRepoStageDirError
} = require('../lib/errors');

const getMock = config =>
  proxyquire('../lib/tasks', {
    './config': { config }
  });

const tmp = 'test/resources/tmp';

const prepare = async () => {
  shell.rm('-rf', tmp);
  shell.mkdir(tmp);
  shell.pushd('-q', tmp);
  await run('git init');
  await run('git remote add origin foo');
  await run('!touch file1');
  await run('git add file1');
  await run('git commit -am "Add file1"');
};

const cleanup = async () => {
  shell.popd('-q');
  shell.rm('-rf', tmp);
};

test('should throw when not a Git repository', async t => {
  const tasks = getMock(new Config());
  shell.pushd('-q', '..');
  await t.shouldBailOut(tasks(), GitRepoError, /Not a git repository/);
  shell.popd('-q');
  t.end();
});

test('should throw if there is no remote Git url', async t => {
  const tasks = getMock(new Config());
  await prepare();
  await run('git remote remove origin');
  await t.shouldBailOut(tasks(), GitRemoteUrlError, /Could not get remote Git url/);
  await cleanup();
  t.end();
});

test('should throw if working dir is not clean', async t => {
  const tasks = getMock(new Config());
  await prepare();
  await run('rm file1');
  await t.shouldBailOut(tasks(), GitCleanWorkingDirError, /Working dir must be clean/);
  await cleanup();
  t.end();
});

test('should throw if no upstream is configured', async t => {
  const tasks = getMock(
    new Config({
      git: {
        requireUpstream: true
      }
    })
  );
  await prepare();
  await t.shouldBailOut(tasks(), GitUpstreamError, /No upstream configured for current branch/);
  await cleanup();
  t.end();
});

test('should throw if no GitHub token environment variable is set', async t => {
  const tasks = getMock(
    new Config({
      github: {
        release: true,
        tokenRef: 'GITHUB_FOO'
      }
    })
  );
  await prepare();
  await t.shouldBailOut(tasks(), GithubTokenError, /Environment variable "GITHUB_FOO" is required for GitHub releases/);
  await cleanup();
  t.end();
});

test('should throw if invalid increment value is provided', async t => {
  const tasks = getMock(
    new Config({
      increment: 'mini',
      'non-interactive': true,
      github: {
        release: false
      }
    })
  );
  await prepare();
  await t.shouldBailOut(tasks(), InvalidVersionError, /invalid version was provided/);
  await cleanup();
  t.end();
});

test('should throw if not a subdir is provided for dist.staging', async t => {
  const tasks = getMock(
    new Config({
      increment: 'patch',
      'non-interactive': true,
      dist: {
        repo: 'foo',
        stageDir: '..'
      }
    })
  );
  await prepare();
  await t.shouldBailOut(tasks(), DistRepoStageDirError, /`dist.stageDir` \(".."\) must resolve to a sub directory/);
  await cleanup();
  t.end();
});
