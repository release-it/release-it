const { EOL } = require('os');
const test = require('tape');
const sinon = require('sinon');
const sh = require('shelljs');
const semver = require('semver');
const mockStdIo = require('mock-stdio');
const { config } = require('../lib/config');
const { readFile, readJSON } = require('./util/index');
const shell = require('../lib/shell');
const {
  isGitRepo,
  isInGitRootDir,
  hasUpstream,
  getBranchName,
  tagExists,
  getRemoteUrl,
  isWorkingDirClean,
  clone,
  stage,
  status,
  reset,
  commit,
  tag,
  getLatestTag,
  push,
  getChangelog,
  isSameRepo
} = require('../lib/git');

const tmp = 'test/resources/tmp';

const initBare = async (barePath, clonePath) => {
  sh.exec(`git init --bare ${barePath}`);
  await clone(barePath, clonePath);
  sh.cp('package.json', clonePath);
  sh.pushd('-q', clonePath);
  await stage('package.json');
  await commit({ message: 'Add package.json' });
};

test('isGitRepo', async t => {
  t.ok(await isGitRepo());
  const tmp = '..';
  sh.pushd('-q', tmp);
  t.notOk(await isGitRepo());
  sh.popd('-q');
  t.end();
});

test('isInGitRootDir', async t => {
  sh.mkdir(tmp);
  sh.pushd('-q', tmp);
  t.notOk(await isInGitRootDir());
  sh.exec('git init');
  t.ok(await isInGitRootDir());
  sh.popd('-q');
  sh.rm('-rf', tmp);
  t.end();
});

test('hasUpstream', async t => {
  sh.mkdir(tmp);
  sh.pushd('-q', tmp);
  sh.exec('git init');
  sh.touch('file1');
  sh.exec('git add file1');
  sh.exec('git commit -am "Add file1"');
  t.notOk(await hasUpstream());
  sh.popd('-q');
  sh.rm('-rf', tmp);
  t.end();
});

test('getBranchName', async t => {
  sh.mkdir(tmp);
  sh.pushd('-q', tmp);
  sh.exec('git init');
  t.equal(await getBranchName(), null);
  sh.exec('git checkout -b feat');
  sh.touch('file1');
  sh.exec('git add file1');
  sh.exec('git commit -am "Add file1"');
  t.equal(await getBranchName(), 'feat');
  sh.popd('-q');
  sh.rm('-rf', tmp);
  t.end();
});

test('tagExists + isWorkingDirClean', async t => {
  sh.mkdir(tmp);
  sh.pushd('-q', tmp);
  sh.exec('git init');
  t.notOk(await tagExists('1.0.0'));
  sh.touch('file1');
  t.notOk(await isWorkingDirClean());
  sh.exec('git add file1');
  sh.exec('git commit -am "Add file1"');
  sh.exec('git tag 1.0.0');
  t.ok(await tagExists('1.0.0'));
  t.ok(await isWorkingDirClean());
  sh.popd('-q');
  sh.rm('-rf', tmp);
  t.end();
});

test('getRemoteUrl', async t => {
  sh.mkdir(tmp);
  sh.pushd('-q', tmp);
  sh.exec(`git init`);
  t.equal(await getRemoteUrl(), null);
  t.equal(await getRemoteUrl('git://github.com/webpro/release-it.git'), 'git://github.com/webpro/release-it.git');
  t.equal(await getRemoteUrl('git@github.com:webpro/release-it.git'), 'git@github.com:webpro/release-it.git');
  t.equal(await getRemoteUrl('https://github.com/webpro/release-it.git'), 'https://github.com/webpro/release-it.git');
  sh.exec(`git remote add origin foo`);
  t.equal(await getRemoteUrl(), 'foo');
  t.equal(await getRemoteUrl('origin'), 'foo');
  sh.exec(`git remote add another bar`);
  t.equal(await getRemoteUrl('another'), 'bar');
  sh.popd('-q');
  sh.rm('-rf', tmp);
  t.end();
});

test('clone + stage + commit + tag + push', async t => {
  const tmpOrigin = 'test/resources/bare.git';
  await initBare(tmpOrigin, tmp);
  const pkgBefore = await readJSON('package.json');
  const versionBefore = pkgBefore.version;
  sh.exec(`git tag ${versionBefore}`);
  const actual_latestTagBefore = await getLatestTag();
  t.ok(await isGitRepo());
  t.equal(versionBefore, actual_latestTagBefore);
  sh.exec('echo line >> file1');
  await stage('file1');
  await commit({ message: 'Update file1' });
  sh.exec('npm --no-git-tag-version version patch');
  await stage('package.json');
  const nextVersion = semver.inc(versionBefore, 'patch');
  await commit({ message: `Release v${nextVersion}` });
  await tag({ name: `v${nextVersion}`, annotation: `Release v${nextVersion}` });
  const pkgAfter = await readJSON('package.json');
  const actual_latestTagAfter = await getLatestTag();
  t.equal(pkgAfter.version, actual_latestTagAfter);
  await push();
  const status = sh.exec('git status -uno');
  t.ok(status.includes('nothing to commit'));
  sh.popd('-q');
  sh.rm('-rf', [tmpOrigin, tmp]);
  t.end();
});

test('push', async t => {
  const tmpOrigin = 'test/resources/bare.git';
  await initBare(tmpOrigin, tmp);
  await push();
  const actual = sh.exec('git ls-tree -r HEAD --name-only', { cwd: '../bare.git' });
  t.equal(actual.trim(), 'package.json');
  sh.popd('-q');
  sh.rm('-rf', [tmpOrigin, tmp]);
  t.end();
});

test('push (pushRepo)', async t => {
  const tmpOrigin = 'test/resources/bare.git';
  await initBare(tmpOrigin, tmp);
  const spy = sinon.spy(shell, 'run');
  await push({ pushRepo: 'origin', hasUpstreamBranch: true });
  t.equal(spy.callCount, 1);
  t.equal(spy.firstCall.args[0].trim(), 'git push --follow-tags  origin');
  const actual = sh.exec('git ls-tree -r HEAD --name-only', { cwd: '../bare.git' });
  t.equal(actual.trim(), 'package.json');
  sh.popd('-q');
  sh.rm('-rf', [tmpOrigin, tmp]);
  spy.restore();
  t.end();
});

test('push (pushRepo url)', async t => {
  const tmpOrigin = 'test/resources/bare.git';
  await initBare(tmpOrigin, tmp);
  const stub = sinon.stub(shell, 'run');
  await push({ pushRepo: 'https://host/repo.git', hasUpstreamBranch: true });
  t.equal(stub.callCount, 1);
  t.equal(stub.firstCall.args[0].trim(), 'git push --follow-tags  https://host/repo.git');
  sh.popd('-q');
  sh.rm('-rf', [tmpOrigin, tmp]);
  stub.restore();
  t.end();
});

test('push (pushRepo not "origin")', async t => {
  const tmpOrigin = 'test/resources/bare.git';
  await initBare(tmpOrigin, tmp);
  sh.exec(`git remote add upstream ${sh.exec('git remote get-url origin')}`);
  const spy = sinon.spy(shell, 'run');
  await push({ pushRepo: 'upstream', hasUpstreamBranch: false });
  t.equal(spy.callCount, 2);
  t.equal(spy.secondCall.args[0].trim(), 'git push --follow-tags   -u upstream master');
  t.equal(await spy.firstCall.returnValue, 'master');
  t.equal(await spy.secondCall.returnValue, "Branch 'master' set up to track remote branch 'master' from 'upstream'.");
  const actual = sh.exec('git ls-tree -r HEAD --name-only', { cwd: '../bare.git' });
  t.equal(actual.trim(), 'package.json');
  sh.popd('-q');
  sh.rm('-rf', [tmpOrigin, tmp]);
  spy.restore();
  t.end();
});

test('status', async t => {
  sh.mkdir(tmp);
  sh.pushd('-q', tmp);
  sh.exec('git init');
  sh.exec('echo line >> file1');
  sh.exec('git add file1');
  sh.exec('git commit -am "Add file1"');
  sh.exec('echo line >> file1');
  sh.exec('echo line >> file2');
  sh.exec('git add file2');
  t.equal(await status(), 'M file1\nA  file2');
  sh.popd('-q');
  sh.rm('-rf', tmp);
  t.end();
});

test('reset', async t => {
  sh.mkdir(tmp);
  sh.pushd('-q', tmp);
  sh.exec('git init');
  sh.exec('echo line >> file1');
  sh.exec('git add file1');
  sh.exec('git commit -am "Add file1"');
  sh.exec('echo line >> file1');
  t.ok(/^line\s*line\s*$/.test(await readFile('file1')));
  await reset('file1');
  t.ok(/^line\s*$/.test(await readFile('file1')));
  mockStdIo.start();
  await reset(['file2, file3']);
  const { stdout } = mockStdIo.end();
  t.ok(/Could not reset file2, file3/.test(stdout));
  sh.popd('-q');
  sh.rm('-rf', tmp);
  t.end();
});

test('getChangelog', async t => {
  sh.mkdir(tmp);
  sh.pushd('-q', tmp);
  sh.exec('git init');
  sh.exec('echo line >> file && git add file && git commit -m "First commit"');
  sh.exec('echo line >> file && git add file && git commit -m "Second commit"');
  await t.shouldReject(
    getChangelog({
      command: 'git log --invalid',
      tagName: '${version}',
      latestVersion: '1.0.0'
    }),
    /Could not create changelog/
  );

  const changelog = await getChangelog({
    command: config.options.scripts.changelog,
    tagName: '${version}',
    latestVersion: '1.0.0'
  });
  const pattern = /^\* Second commit \(\w{7}\)\n\* First commit \(\w{7}\)$/;
  t.ok(pattern.test(changelog));

  sh.exec('git tag 1.0.0');
  sh.exec('echo line C >> file && git add file && git commit -m "Third commit"');
  sh.exec('echo line D >> file && git add file && git commit -m "Fourth commit"');

  const changelogSinceTag = await getChangelog({
    command: config.options.scripts.changelog,
    tagName: '${version}',
    latestVersion: '1.0.0'
  });
  const pattern1 = /^\* Fourth commit \(\w{7}\)\n\* Third commit \(\w{7}\)$/;
  t.ok(pattern1.test(changelogSinceTag));

  sh.popd('-q');
  sh.rm('-rf', tmp);
  t.end();
});

test('getChangelog (custom)', async t => {
  const changelog = await getChangelog({
    command: 'echo ${name}'
  });
  t.equal(changelog, 'release-it');
  t.end();
});

test('isSameRepo', t => {
  const repoA = {
    remote: 'https://github.com/webpro/release-it.git',
    protocol: 'https',
    host: 'github.com',
    repository: 'webpro/release-it',
    owner: 'webpro',
    project: 'release-it-test'
  };
  const repoB = Object.assign({}, repoA, {
    remote: 'https://github.com/webpro/release-it.git#dist'
  });
  t.ok(isSameRepo(repoA, repoB));
  t.end();
});
