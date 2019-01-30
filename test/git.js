const test = require('ava');
const sinon = require('sinon');
const sh = require('shelljs');
const { mkTmpDir, readFile, gitAdd } = require('./util/helpers');
const { factory } = require('./util');
const Git = require('../lib/plugin/git/git');

test.beforeEach(() => {
  const tmp = mkTmpDir();
  sh.pushd('-q', tmp);
});

test.serial('should detect Git repo', async t => {
  const gitClient = factory(Git);
  t.false(await gitClient.isGitRepo());
  sh.exec('git init');
  t.true(await gitClient.isGitRepo());
});

test.serial('should return whether repo has upstream branch', async t => {
  const gitClient = factory(Git);
  sh.exec('git init');
  gitAdd('line', 'file', 'Add file');
  t.false(await gitClient.hasUpstreamBranch());
});

test.serial('should return branch name', async t => {
  const gitClient = factory(Git);
  sh.exec('git init');
  t.is(await gitClient.getBranchName(), null);
  sh.exec('git checkout -b feat');
  gitAdd('line', 'file', 'Add file');
  t.is(await gitClient.getBranchName(), 'feat');
});

test.serial('should return whether tag exists and if working dir is clean', async t => {
  const gitClient = factory(Git);
  sh.exec('git init');
  t.false(await gitClient.tagExists('1.0.0'));
  sh.touch('file');
  t.false(await gitClient.isWorkingDirClean());
  gitAdd('line', 'file', 'Add file');
  sh.exec('git tag 1.0.0');
  t.true(await gitClient.tagExists('1.0.0'));
  t.true(await gitClient.isWorkingDirClean());
});

test.serial('should return the remote url', async t => {
  sh.exec(`git init`);
  {
    const options = { git: { pushRepo: 'origin' } };
    const gitClient = factory(Git, { options });
    t.is(await gitClient.getRemoteUrl(), null);
    sh.exec(`git remote add origin foo`);
    t.is(await gitClient.getRemoteUrl(), 'foo');
  }
  {
    const options = { git: { pushRepo: 'another' } };
    const gitClient = factory(Git, { options });
    t.is(await gitClient.getRemoteUrl(), null);
    sh.exec(`git remote add another bar`);
    t.is(await gitClient.getRemoteUrl(), 'bar');
  }
  {
    const options = { git: { pushRepo: 'git://github.com/webpro/release-it.git' } };
    const gitClient = factory(Git, { options });
    t.is(await gitClient.getRemoteUrl(), 'git://github.com/webpro/release-it.git');
  }
});

test.serial('should stage, commit, tag and push', async t => {
  const bare = mkTmpDir();
  sh.exec(`git init --bare ${bare}`);
  sh.exec(`git clone ${bare} .`);
  const version = '1.2.3';
  gitAdd(`{"version":"${version}"}`, 'package.json', 'Add package.json');
  const gitClient = factory(Git);
  {
    sh.exec(`git tag ${version}`);
    const latestTagName = await gitClient.getLatestTagName();
    t.true(await gitClient.isGitRepo());
    t.is(version, latestTagName);
  }
  {
    gitAdd('line', 'file', 'Add file');
    sh.exec('npm --no-git-tag-version version patch');
    await gitClient.stage('package.json');
    await gitClient.commit({ message: `Release v1.2.4` });
    await gitClient.tag({ name: 'v1.2.4', annotation: 'Release v1.2.4' });
    t.is(await gitClient.getLatestTagName(), 'v1.2.4');
    await gitClient.push();
    const status = sh.exec('git status -uno');
    t.true(status.includes('nothing to commit'));
  }
});

test.serial('should commit, tag and push with extra args', async t => {
  const bare = mkTmpDir();
  sh.exec(`git init --bare ${bare}`);
  sh.exec(`git clone ${bare} .`);
  gitAdd('line', 'file', 'Add file');
  const options = { git: { commitArgs: '-S', tagArgs: '-T foo', pushArgs: '-U bar -V' } };
  const gitClient = factory(Git, { options });
  const spy = sinon.stub(gitClient.shell, 'exec').resolves();
  await gitClient.stage('package.json');
  await gitClient.commit({ message: `Release v1.2.4` });
  await gitClient.tag({ name: 'v1.2.4', annotation: 'Release v1.2.4' });
  await gitClient.push();
  t.true(spy.secondCall.args[0].includes(' -S'));
  t.true(spy.thirdCall.args[0].includes(' -T foo'));
  t.true(spy.lastCall.args[0].includes(' -U bar -V'));
  spy.restore();
});

test.serial('should push to origin', async t => {
  const bare = mkTmpDir();
  sh.exec(`git init --bare ${bare}`);
  sh.exec(`git clone ${bare} .`);
  gitAdd('line', 'file', 'Add file');
  const gitClient = factory(Git);
  const spy = sinon.spy(gitClient.shell, 'exec');
  await gitClient.push();
  t.is(spy.lastCall.args[0], 'git push --follow-tags  origin');
  const actual = sh.exec('git ls-tree -r HEAD --name-only', { cwd: bare });
  t.is(actual.trim(), 'file');
  spy.restore();
});

test.serial('should push to repo url', async t => {
  const bare = mkTmpDir();
  sh.exec(`git init --bare ${bare}`);
  sh.exec(`git clone ${bare} .`);
  gitAdd('line', 'file', 'Add file');
  const options = { git: { pushRepo: 'https://host/repo.git' } };
  const gitClient = factory(Git, { options });
  const spy = sinon.spy(gitClient.shell, 'exec');
  try {
    await gitClient.push();
  } catch (err) {
    t.is(spy.lastCall.args[0], 'git push --follow-tags  https://host/repo.git');
  }
  spy.restore();
});

test.serial('should push to remote name (not "origin")', async t => {
  const bare = mkTmpDir();
  sh.exec(`git init --bare ${bare}`);
  sh.exec(`git clone ${bare} .`);
  gitAdd('line', 'file', 'Add file');
  sh.exec(`git remote add upstream ${sh.exec('git remote get-url origin')}`);
  const options = { git: { pushRepo: 'upstream' } };
  const gitClient = factory(Git, { options });
  const spy = sinon.spy(gitClient.shell, 'exec');
  await gitClient.push();
  t.is(spy.lastCall.args[0], 'git push --follow-tags  upstream');
  const actual = sh.exec('git ls-tree -r HEAD --name-only', { cwd: bare });
  t.is(actual.trim(), 'file');
  {
    sh.exec(`git checkout -b foo`);
    gitAdd('line', 'file', 'Add file');
    await gitClient.push();
    t.is(spy.lastCall.args[0], 'git push --follow-tags  -u upstream foo');
    t.is(await spy.lastCall.returnValue, "Branch 'foo' set up to track remote branch 'foo' from 'upstream'.");
  }
  spy.restore();
});

test.serial('should return repo status', async t => {
  const gitClient = factory(Git);
  sh.exec('git init');
  gitAdd('line', 'file1', 'Add file');
  sh.ShellString('line').toEnd('file1');
  sh.ShellString('line').toEnd('file2');
  sh.exec('git add file2');
  t.is(await gitClient.status(), 'M file1\nA  file2');
});

test.serial('should reset files', async t => {
  const gitClient = factory(Git);
  sh.exec('git init');
  gitAdd('line', 'file', 'Add file');
  sh.ShellString('line').toEnd('file');
  t.regex(await readFile('file'), /^line\s*line\s*$/);
  await gitClient.reset('file');
  t.regex(await readFile('file'), /^line\s*$/);
  await gitClient.reset(['file2, file3']);
  t.regex(gitClient.log.warn.firstCall.args[0], /Could not reset file2, file3/);
});
