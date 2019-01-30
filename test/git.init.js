const test = require('ava');
const sh = require('shelljs');
const { mkTmpDir, gitAdd } = require('./util/helpers');
const { factory } = require('./util');
const Shell = require('../lib/shell');
const Log = require('../lib/log');
const Git = require('../lib/plugin/git/git');
const { git } = require('../conf/release-it.json');
const { GitRepoError, GitRemoteUrlError, GitCleanWorkingDirError, GitUpstreamError } = require('../lib/errors');

test.serial.beforeEach(t => {
  const bare = mkTmpDir();
  const target = mkTmpDir();
  sh.pushd('-q', bare);
  sh.exec(`git init --bare .`);
  sh.exec(`git clone ${bare} ${target}`);
  sh.pushd('-q', target);
  gitAdd('line', 'file', 'Add file');
  const gitClient = factory(Git, { options: { git } });
  t.context = { gitClient, bare, target };
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
  const log = new Log();
  const shell = new Shell({ container: { log } });
  const gitClient = factory(Git, { container: { shell } });
  const { bare, target } = t.context;
  const other = mkTmpDir();
  await gitClient.init();
  t.is(gitClient.getContext('latestTagName'), null);
  sh.exec('git push');
  sh.exec(`git clone ${bare} ${other}`);
  sh.pushd('-q', other);
  sh.exec('git tag 1.0.0');
  sh.exec('git push --tags');
  sh.pushd('-q', target);
  await gitClient.init();
  t.is(gitClient.getContext('latestTagName'), '1.0.0');
});
