const path = require('path');
const test = require('ava');
const sinon = require('sinon');
const sh = require('shelljs');
const uuid = require('uuid/v4');
const { readFile, gitAdd } = require('./util/index');
const Shell = require('../lib/shell');
const Log = require('../lib/log');
const Git = require('../lib/git');
const GitDist = require('../lib/git-dist');

const sandbox = sinon.createSandbox();
const log = sandbox.createStubInstance(Log);

const shell = new Shell();
const gitClient = new Git({ log });

const cwd = path.resolve(process.cwd());

test.beforeEach(() => {
  const tmp = path.join(cwd, 'tmp', uuid());
  sh.mkdir('-p', tmp);
  sh.pushd('-q', tmp);
});

test.afterEach(() => {
  sh.pushd('-q', cwd);
  sandbox.resetHistory();
});

test.serial('should detect Git repo', async t => {
  t.true(await gitClient.isGitRepo());
  const tmp = '../../..';
  sh.pushd('-q', tmp);
  t.false(await gitClient.isGitRepo());
  sh.popd('-q');
});

test.serial('should detect if in Git root directory', async t => {
  t.false(await gitClient.isInGitRootDir());
  sh.exec('git init');
  t.true(await gitClient.isInGitRootDir());
});

test.serial('should return whether repo has upstream branch', async t => {
  sh.exec('git init');
  gitAdd('line', 'file', 'Add file');
  t.false(await gitClient.hasUpstreamBranch());
});

test.serial('should return branch name', async t => {
  sh.exec('git init');
  t.is(await gitClient.getBranchName(), null);
  sh.exec('git checkout -b feat');
  gitAdd('line', 'file', 'Add file');
  t.is(await gitClient.getBranchName(), 'feat');
});

test.serial('should return whether tag exists and if working dir is clean', async t => {
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
    const gitClient = new Git({ pushRepo: 'origin' });
    t.is(await gitClient.getRemoteUrl(), null);
    sh.exec(`git remote add origin foo`);
    t.is(await gitClient.getRemoteUrl(), 'foo');
  }
  {
    const gitClient = new Git({ pushRepo: 'another' });
    t.is(await gitClient.getRemoteUrl(), null);
    sh.exec(`git remote add another bar`);
    t.is(await gitClient.getRemoteUrl(), 'bar');
  }
  {
    const gitClient = new Git({ pushRepo: 'git://github.com/webpro/release-it.git' });
    t.is(await gitClient.getRemoteUrl(), 'git://github.com/webpro/release-it.git');
  }
});

test.serial('should clone, stage, commit, tag and push', async t => {
  const bare = `../${uuid()}`;
  sh.exec(`git init --bare ${bare}`);
  const gitClient = new Git();
  const gitDistClient = new GitDist();
  await gitDistClient.clone(bare, '.');
  await gitClient.init();
  const version = '1.2.3';
  gitAdd(`{"version":"${version}"}`, 'package.json', 'Add package.json');
  {
    sh.exec(`git tag ${version}`);
    const latestTag = await gitClient.getLatestTag();
    t.true(await gitClient.isGitRepo());
    t.is(version, latestTag);
  }
  {
    gitAdd('line', 'file', 'Add file');
    sh.exec('npm --no-git-tag-version version patch');
    await gitClient.stage('package.json');
    await gitClient.commit({ message: `Release v1.2.4` });
    await gitClient.tag({ name: 'v1.2.4', annotation: 'Release v1.2.4' });
    t.is(await gitClient.getLatestTag(), 'v1.2.4');
    await gitClient.push();
    const status = sh.exec('git status -uno');
    t.true(status.includes('nothing to commit'));
  }
});

test.serial('should push to origin', async t => {
  const bare = `../${uuid()}`;
  sh.exec(`git init --bare ${bare}`);
  sh.exec(`git clone ${bare} .`);
  const gitClient = new Git({ shell });
  await gitClient.init();
  gitAdd('line', 'file', 'Add file');
  const spy = sinon.spy(shell, 'run');
  await gitClient.push();
  t.is(spy.lastCall.args[0].trim(), 'git push --follow-tags  origin');
  const actual = sh.exec('git ls-tree -r HEAD --name-only', { cwd: bare });
  t.is(actual.trim(), 'file');
  spy.restore();
});

test.serial('should push to repo url', async t => {
  const bare = `../${uuid()}`;
  sh.exec(`git init --bare ${bare}`);
  sh.exec(`git clone ${bare} .`);
  const gitClient = new Git({ pushRepo: 'https://host/repo.git', shell });
  await gitClient.init();
  gitAdd('line', 'file', 'Add file');
  const spy = sinon.spy(shell, 'run');
  try {
    await gitClient.push();
  } catch (err) {
    t.is(spy.lastCall.args[0].trim(), 'git push --follow-tags  https://host/repo.git');
  }
  spy.restore();
});

test.serial('should push to remote name (not "origin")', async t => {
  const bare = `../${uuid()}`;
  sh.exec(`git init --bare ${bare}`);
  sh.exec(`git clone ${bare} .`);
  const gitClient = new Git();
  await gitClient.init();
  sh.exec(`git remote add upstream ${sh.exec('git remote get-url origin')}`);
  {
    const gitClient = new Git({ pushRepo: 'upstream', shell });
    gitAdd('line', 'file', 'Add file');
    const spy = sinon.spy(shell, 'run');
    await gitClient.push();
    t.is(spy.lastCall.args[0].trim(), 'git push --follow-tags  upstream');
    const actual = sh.exec('git ls-tree -r HEAD --name-only', { cwd: bare });
    t.is(actual.trim(), 'file');
    {
      sh.exec(`git checkout -b foo`);
      gitAdd('line', 'file', 'Add file');
      await gitClient.push();
      t.is(spy.lastCall.args[0].trim(), 'git push --follow-tags  -u upstream foo');
      t.is(await spy.lastCall.returnValue, "Branch 'foo' set up to track remote branch 'foo' from 'upstream'.");
    }
    spy.restore();
  }
});

test.serial('should return repo status', async t => {
  sh.exec('git init');
  gitAdd('line', 'file1', 'Add file');
  sh.ShellString('line').toEnd('file1');
  sh.ShellString('line').toEnd('file2');
  sh.exec('git add file2');
  t.is(await gitClient.status(), 'M file1\nA  file2');
});

test.serial('should reset files', async t => {
  sh.exec('git init');
  gitAdd('line', 'file', 'Add file');
  sh.ShellString('line').toEnd('file');
  t.regex(await readFile('file'), /^line\s*line\s*$/);
  await gitClient.reset('file');
  t.regex(await readFile('file'), /^line\s*$/);
  await gitClient.reset(['file2, file3']);
  t.regex(log.warn.firstCall.args[0], /Could not reset file2, file3/);
});

test.serial('should check whether two repos are the same (based on host, owner, project)', async t => {
  const gitClient = new Git();
  await gitClient.init();
  const otherClient = new Git();
  await otherClient.init();
  t.true(gitClient.isSameRepo(otherClient));
  {
    const bare = `../${uuid()}`;
    sh.exec(`git init --bare ${bare}`);
    sh.exec(`git clone ${bare} .`);
    const otherClient = new Git();
    await otherClient.init();
    t.false(gitClient.isSameRepo(otherClient));
  }
});
