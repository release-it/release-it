const path = require('path');
const test = require('tape');
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

const prepare = () => {
  const tmp = path.join(cwd, 'tmp', uuid());
  sh.mkdir('-p', tmp);
  sh.pushd('-q', tmp);
};

const cleanup = () => {
  sh.pushd('-q', cwd);
  sandbox.resetHistory();
};

test('isGitRepo', async t => {
  t.ok(await gitClient.isGitRepo());
  const tmp = '..';
  sh.pushd('-q', tmp);
  t.notOk(await gitClient.isGitRepo());
  sh.popd('-q');
  t.end();
});

test('isInGitRootDir', async t => {
  prepare();
  t.notOk(await gitClient.isInGitRootDir());
  sh.exec('git init');
  t.ok(await gitClient.isInGitRootDir());
  cleanup();
  t.end();
});

test('hasUpstream', async t => {
  prepare();
  sh.exec('git init');
  gitAdd('line', 'file', 'Add file');
  t.notOk(await gitClient.hasUpstreamBranch());
  cleanup();
  t.end();
});

test('getBranchName', async t => {
  prepare();
  sh.exec('git init');
  t.equal(await gitClient.getBranchName(), null);
  sh.exec('git checkout -b feat');
  gitAdd('line', 'file', 'Add file');
  t.equal(await gitClient.getBranchName(), 'feat');
  cleanup();
  t.end();
});

test('tagExists + isWorkingDirClean', async t => {
  prepare();
  sh.exec('git init');
  t.notOk(await gitClient.tagExists('1.0.0'));
  sh.touch('file');
  t.notOk(await gitClient.isWorkingDirClean());
  gitAdd('line', 'file', 'Add file');
  sh.exec('git tag 1.0.0');
  t.ok(await gitClient.tagExists('1.0.0'));
  t.ok(await gitClient.isWorkingDirClean());
  cleanup();
  t.end();
});

test('getRemoteUrl', async t => {
  prepare();
  sh.exec(`git init`);
  {
    const gitClient = new Git({ pushRepo: 'origin' });
    t.equal(await gitClient.getRemoteUrl(), null);
    sh.exec(`git remote add origin foo`);
    t.equal(await gitClient.getRemoteUrl(), 'foo');
  }
  {
    const gitClient = new Git({ pushRepo: 'another' });
    t.equal(await gitClient.getRemoteUrl(), null);
    sh.exec(`git remote add another bar`);
    t.equal(await gitClient.getRemoteUrl(), 'bar');
  }
  {
    const gitClient = new Git({ pushRepo: 'git://github.com/webpro/release-it.git' });
    t.equal(await gitClient.getRemoteUrl(), 'git://github.com/webpro/release-it.git');
  }
  cleanup();
  t.end();
});

test('clone + stage + commit + tag + push', async t => {
  prepare();
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
    t.ok(await gitClient.isGitRepo());
    t.equal(version, latestTag);
  }
  {
    gitAdd('line', 'file', 'Add file');
    sh.exec('npm --no-git-tag-version version patch');
    await gitClient.stage('package.json');
    await gitClient.commit({ message: `Release v1.2.4` });
    await gitClient.tag({ name: 'v1.2.4', annotation: 'Release v1.2.4' });
    t.equal(await gitClient.getLatestTag(), 'v1.2.4');
    await gitClient.push();
    const status = sh.exec('git status -uno');
    t.ok(status.includes('nothing to commit'));
  }
  cleanup();
  t.end();
});

test('push', async t => {
  prepare();
  const bare = `../${uuid()}`;
  sh.exec(`git init --bare ${bare}`);
  sh.exec(`git clone ${bare} .`);
  const gitClient = new Git({ shell });
  await gitClient.init();
  gitAdd('line', 'file', 'Add file');
  const spy = sinon.spy(shell, 'run');
  await gitClient.push();
  t.equal(spy.lastCall.args[0].trim(), 'git push --follow-tags  origin');
  const actual = sh.exec('git ls-tree -r HEAD --name-only', { cwd: bare });
  t.equal(actual.trim(), 'file');
  spy.restore();
  cleanup();
  t.end();
});

test('push (pushRepo url)', async t => {
  prepare();
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
    t.equal(spy.lastCall.args[0].trim(), 'git push --follow-tags  https://host/repo.git');
  }
  spy.restore();
  cleanup();
  t.end();
});

test('push (pushRepo not "origin")', async t => {
  prepare();
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
    t.equal(spy.lastCall.args[0].trim(), 'git push --follow-tags  upstream');
    const actual = sh.exec('git ls-tree -r HEAD --name-only', { cwd: bare });
    t.equal(actual.trim(), 'file');
    {
      sh.exec(`git checkout -b foo`);
      gitAdd('line', 'file', 'Add file');
      await gitClient.push();
      t.equal(spy.lastCall.args[0].trim(), 'git push --follow-tags  -u upstream foo');
      t.equal(await spy.lastCall.returnValue, "Branch 'foo' set up to track remote branch 'foo' from 'upstream'.");
    }
    spy.restore();
  }
  cleanup();
  t.end();
});

test('status', async t => {
  prepare();
  sh.exec('git init');
  gitAdd('line', 'file1', 'Add file');
  sh.ShellString('line').toEnd('file1');
  sh.ShellString('line').toEnd('file2');
  sh.exec('git add file2');
  t.equal(await gitClient.status(), 'M file1\nA  file2');
  cleanup();
  t.end();
});

test('reset', async t => {
  prepare();
  sh.exec('git init');
  gitAdd('line', 'file', 'Add file');
  sh.ShellString('line').toEnd('file');
  t.ok(/^line\s*line\s*$/.test(await readFile('file')));
  await gitClient.reset('file');
  t.ok(/^line\s*$/.test(await readFile('file')));
  await gitClient.reset(['file2, file3']);
  t.equal(log.warn.firstCall.args[0], 'Could not reset file2, file3');
  cleanup();
  t.end();
});

test('isSameRepo', async t => {
  const gitClient = new Git();
  await gitClient.init();
  const otherClient = new Git();
  await otherClient.init();
  t.ok(gitClient.isSameRepo(otherClient));
  {
    prepare();
    const bare = `../${uuid()}`;
    sh.exec(`git init --bare ${bare}`);
    sh.exec(`git clone ${bare} .`);
    const otherClient = new Git();
    await otherClient.init();
    t.notOk(gitClient.isSameRepo(otherClient));
  }
  cleanup();
  t.end();
});
