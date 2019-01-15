const path = require('path');
const test = require('ava');
const sh = require('shelljs');
const { gitAdd } = require('./util/index');
const uuid = require('uuid/v4');
const sinon = require('sinon');
const Git = require('../lib/git');
const { GitRepoError, GitRemoteUrlError, GitCleanWorkingDirError, GitUpstreamError } = require('../lib/errors');

const cwd = process.cwd();

const sandbox = sinon.createSandbox();

test.serial.beforeEach(t => {
  const bare = path.resolve(cwd, 'tmp', uuid());
  const target = path.resolve(cwd, 'tmp', uuid());
  sh.pushd('-q', `${cwd}/tmp`);
  sh.exec(`git init --bare ${bare}`);
  sh.exec(`git clone ${bare} ${target}`);
  sh.pushd('-q', target);
  gitAdd('line', 'file', 'Add file');
  const gitClient = new Git();
  t.context = { gitClient, bare, target };
});

test.serial.afterEach(() => {
  sh.pushd('-q', cwd);
  sandbox.resetHistory();
});

test.serial('should throw when not a Git repository', async t => {
  const { gitClient } = t.context;
  sh.pushd('-q', '../../..');
  const expected = { instanceOf: GitRepoError, message: /not \(inside\) a Git repository/ };
  await t.throwsAsync(gitClient.init(), expected);
  sh.popd('-q');
});

test.serial('should throw if there is no remote Git url', async t => {
  const { gitClient } = t.context;
  sh.exec('git remote remove origin');
  const expected = { instanceOf: GitRemoteUrlError, message: /Could not get remote Git url/ };
  await t.throwsAsync(gitClient.init(), expected);
});

test.serial('should throw if working dir is not clean', async t => {
  const { gitClient } = t.context;
  sh.exec('rm file');
  const expected = { instanceOf: GitCleanWorkingDirError, message: /Working dir must be clean/ };
  await t.throwsAsync(gitClient.init(), expected);
});

test.serial('should throw if no upstream is configured', async t => {
  const { gitClient } = t.context;
  sh.exec('git checkout -b foo');
  const expected = { instanceOf: GitUpstreamError, message: /No upstream configured for current branch/ };
  await t.throwsAsync(gitClient.init(), expected);
});

test.serial('should get the latest tag after fetch', async t => {
  const { gitClient, bare, target } = t.context;
  const other = path.resolve(cwd, 'tmp', uuid());
  await gitClient.init();
  t.is(gitClient.latestTag, null);
  sh.exec('git push');
  sh.exec(`git clone ${bare} ${other}`);
  sh.pushd('-q', other);
  sh.exec('git tag 1.0.0');
  sh.exec('git push --tags');
  sh.pushd('-q', target);
  await gitClient.init();
  t.is(gitClient.latestTag, '1.0.0');
});
