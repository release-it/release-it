const test = require('ava');
const sh = require('shelljs');
const Shell = require('../lib/shell');
const Log = require('../lib/log');
const Git = require('../lib/plugin/git/Git');
const { git } = require('../config/release-it.json');
const {
  GitRequiredBranchError,
  GitRemoteUrlError,
  GitCleanWorkingDirError,
  GitUpstreamError,
  GitNoCommitsError
} = require('../lib/errors');
const { factory } = require('./util');
const { mkTmpDir, gitAdd } = require('./util/helpers');

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

test.serial('should throw if on wrong branch', async t => {
  const options = { git: { requireBranch: 'dev' } };
  const gitClient = factory(Git, { options });
  sh.exec('git remote remove origin');
  const expected = { instanceOf: GitRequiredBranchError, message: /Must be on branch dev/ };
  await t.throwsAsync(gitClient.init(), expected);
});

test.serial('should throw if there is no remote Git url', async t => {
  const gitClient = factory(Git, { options: { git } });
  sh.exec('git remote remove origin');
  const expected = { instanceOf: GitRemoteUrlError, message: /Could not get remote Git url/ };
  await t.throwsAsync(gitClient.init(), expected);
});

test.serial('should throw if working dir is not clean', async t => {
  const gitClient = factory(Git, { options: { git } });
  sh.exec('rm file');
  const expected = { instanceOf: GitCleanWorkingDirError, message: /Working dir must be clean/ };
  await t.throwsAsync(gitClient.init(), expected);
});

test.serial('should throw if no upstream is configured', async t => {
  const gitClient = factory(Git, { options: { git } });
  sh.exec('git checkout -b foo');
  const expected = { instanceOf: GitUpstreamError, message: /No upstream configured for current branch/ };
  await t.throwsAsync(gitClient.init(), expected);
});

test.serial('should throw if there are no commits', async t => {
  const options = { git: { requireCommits: true } };
  const gitClient = factory(Git, { options });
  sh.exec('git tag 1.0.0');
  const expected = { instanceOf: GitNoCommitsError, message: /There are no commits since the latest tag/ };
  await t.throwsAsync(gitClient.init(), expected);
});

test.serial('should not throw if there are commits', async t => {
  const options = { git: { requireCommits: true } };
  const gitClient = factory(Git, { options });
  sh.exec('git tag 1.0.0');
  gitAdd('line', 'file', 'Add file');
  await t.notThrowsAsync(gitClient.init());
});

test.serial('should not throw if there are no tags', async t => {
  const options = { git: { requireCommits: true } };
  const gitClient = factory(Git, { options });
  gitAdd('line', 'file', 'Add file');
  await t.notThrowsAsync(gitClient.init());
});

test.serial('should not throw if origin remote is renamed', async t => {
  sh.exec('git remote rename origin upstream');
  const gitClient = factory(Git);
  await t.notThrowsAsync(gitClient.init());
});

test.serial('should detect and include version prefix ("v")', async t => {
  const gitClient = factory(Git, { options: { git } });
  sh.exec('git tag v1.0.0');
  await gitClient.init();
  await gitClient.bump('1.0.1');
  t.is(gitClient.getContext('tagName'), 'v1.0.1');
});

test.serial('should detect and exclude version prefix', async t => {
  const gitClient = factory(Git, { options: { git } });
  sh.exec('git tag 1.0.0');
  await gitClient.init();
  await gitClient.bump('1.0.1');
  t.is(gitClient.getContext('tagName'), '1.0.1');
});

test.serial('should detect and exclude version prefix (configured)', async t => {
  const gitClient = factory(Git, { options: { git: { tagName: 'v${version}' } } });
  sh.exec('git tag 1.0.0');
  await gitClient.init();
  await gitClient.bump('1.0.1');
  t.is(gitClient.getContext('tagName'), 'v1.0.1');
});

test.serial('should honor custom tagName configuration', async t => {
  const gitClient = factory(Git, { options: { git: { tagName: 'TAGNAME-v${version}' } } });
  sh.exec('git tag 1.0.0');
  await gitClient.init();
  await gitClient.bump('1.0.1');
  t.is(gitClient.getContext('tagName'), 'TAGNAME-v1.0.1');
});

test.serial('should get the latest tag after fetch', async t => {
  const log = new Log();
  const shell = new Shell({ container: { log } });
  const gitClient = factory(Git, { container: { shell } });
  const { bare, target } = t.context;
  const other = mkTmpDir();
  sh.exec('git push');
  sh.exec(`git clone ${bare} ${other}`);
  sh.pushd('-q', other);
  sh.exec('git tag 1.0.0');
  sh.exec('git push --tags');
  sh.pushd('-q', target);
  await gitClient.init();
  t.is(gitClient.getContext('latestTagName'), '1.0.0');
});

test.serial('should generate correct changelog', async t => {
  const gitClient = factory(Git, { options: { git } });
  sh.exec('git tag 1.0.0');
  gitAdd('line', 'file', 'Add file');
  gitAdd('line', 'file', 'Add file');
  await gitClient.init();
  const changelog = await gitClient.getChangelog();
  t.regex(changelog, /\* Add file \(\w{7}\)\n\* Add file \(\w{7}\)/);
});
