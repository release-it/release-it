const { EOL } = require('os');
const test = require('ava');
const sinon = require('sinon');
const sh = require('shelljs');
const Git = require('../lib/plugin/git/Git');
const { mkTmpDir, readFile, gitAdd } = require('./util/helpers');
const { factory } = require('./util');

test.beforeEach(() => {
  const tmp = mkTmpDir();
  sh.pushd('-q', tmp);
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

test.serial('should throw if tag exists', async t => {
  const gitClient = factory(Git);
  sh.exec('git init');
  sh.touch('file');
  gitAdd('line', 'file', 'Add file');
  sh.exec('git tag 0.0.2');
  gitClient.setContext({ latestTagName: '0.0.1', tagName: '0.0.2' });
  const expected = { instanceOf: Error, message: /fatal: tag '0\.0\.2' already exists/ };
  await t.throwsAsync(gitClient.tag({ name: '0.0.2' }), expected);
});

test.serial('should only warn if tag exists intentionally', async t => {
  const gitClient = factory(Git);
  const { warn } = gitClient.log;
  sh.exec('git init');
  sh.touch('file');
  gitAdd('line', 'file', 'Add file');
  sh.exec('git tag 1.0.0');
  gitClient.setContext({ latestTagName: '1.0.0', tagName: '1.0.0' });
  await t.notThrowsAsync(gitClient.tag());
  t.is(warn.callCount, 1);
  t.is(warn.firstCall.args[0], 'Tag "1.0.0" already exists');
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

test.serial('should return the non-origin remote', async t => {
  const bare = mkTmpDir();
  sh.exec(`git init --bare ${bare}`);
  sh.exec(`git clone ${bare} .`);
  gitAdd('line', 'file', 'Add file');
  sh.exec('git remote rename origin upstream');
  const gitClient = factory(Git);
  t.is(await gitClient.getRemoteUrl(), bare);
});

test.serial('should stage, commit, tag and push', async t => {
  const bare = mkTmpDir();
  sh.exec(`git init --bare ${bare}`);
  sh.exec(`git clone ${bare} .`);
  const version = '1.2.3';
  gitAdd(`{"version":"${version}"}`, 'package.json', 'Add package.json');
  {
    const gitClient = factory(Git);
    sh.exec(`git tag ${version}`);
    t.is(await gitClient.getLatestTagName(), version);
  }
  {
    const gitClient = factory(Git);
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
  const options = { git: { commitArgs: '-S', tagArgs: ['-T', 'foo'], pushArgs: ['-U', 'bar', '-V'] } };
  const gitClient = factory(Git, { options });
  const stub = sinon.stub(gitClient.shell, 'exec').resolves();
  await gitClient.stage('package.json');
  await gitClient.commit({ message: `Release v1.2.4` });
  await gitClient.tag({ name: 'v1.2.4', annotation: 'Release v1.2.4' });
  await gitClient.push();
  t.true(stub.secondCall.args[0].includes('-S'));
  t.is(stub.thirdCall.args[0][5], '-T');
  t.is(stub.thirdCall.args[0][6], 'foo');
  t.true(stub.lastCall.args[0].join(' ').includes('-U bar -V'));
  stub.restore();
});

test.serial('should commit and tag with quoted characters', async t => {
  const bare = mkTmpDir();
  sh.exec(`git init --bare ${bare}`);
  sh.exec(`git clone ${bare} .`);
  const gitClient = factory(Git, {
    options: { git: { commitMessage: 'Release ${version}', tagAnnotation: 'Release ${version}\n\n${changelog}' } }
  });
  sh.touch('file');
  const changelog = `- Foo's${EOL}- "$bar"${EOL}- '$baz'${EOL}- foo`;
  gitClient.config.setContext({ version: '1.0.0', changelog });

  await gitClient.stage('file');
  await gitClient.commit();
  await gitClient.tag({ name: '1.0.0' });
  await gitClient.push();
  {
    const { stdout } = sh.exec('git log -1 --format=%s');
    t.is(stdout.trim(), 'Release 1.0.0');
  }
  {
    const { stdout } = sh.exec('git tag -n99');
    t.is(stdout.trim(), `1.0.0           Release 1.0.0\n    \n    - Foo's\n    - "$bar"\n    - '$baz'\n    - foo`);
  }
});

test.serial('should push to origin', async t => {
  const bare = mkTmpDir();
  sh.exec(`git init --bare ${bare}`);
  sh.exec(`git clone ${bare} .`);
  gitAdd('line', 'file', 'Add file');
  const gitClient = factory(Git);
  const spy = sinon.spy(gitClient.shell, 'exec');
  await gitClient.push();
  t.deepEqual(spy.lastCall.args[0], ['git', 'push']);
  const actual = sh.exec('git ls-tree -r HEAD --name-only', { cwd: bare });
  t.is(actual.trim(), 'file');
  spy.restore();
});

test.serial('should push to tracked upstream branch', async t => {
  const bare = mkTmpDir();
  sh.exec(`git init --bare ${bare}`);
  sh.exec(`git clone ${bare} .`);
  sh.exec(`git remote rename origin upstream`);
  gitAdd('line', 'file', 'Add file');
  const gitClient = factory(Git);
  const spy = sinon.spy(gitClient.shell, 'exec');
  await gitClient.push();
  t.deepEqual(spy.lastCall.args[0], ['git', 'push']);
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
    t.deepEqual(spy.lastCall.args[0], ['git', 'push', 'https://host/repo.git']);
  }
  spy.restore();
});

test.serial('should push to remote name (not "origin")', async t => {
  const bare = mkTmpDir();
  sh.exec(`git init --bare ${bare}`);
  sh.exec(`git clone ${bare} .`);
  gitAdd('line', 'file', 'Add file');
  sh.exec(`git remote add upstream ${sh.exec('git config --get remote.origin.url')}`);
  const options = { git: { pushRepo: 'upstream' } };
  const gitClient = factory(Git, { options });
  const spy = sinon.spy(gitClient.shell, 'exec');
  await gitClient.push();
  t.deepEqual(spy.lastCall.args[0], ['git', 'push', 'upstream']);
  const actual = sh.exec('git ls-tree -r HEAD --name-only', { cwd: bare });
  t.is(actual.trim(), 'file');
  {
    sh.exec(`git checkout -b foo`);
    gitAdd('line', 'file', 'Add file');
    await gitClient.push();
    t.deepEqual(spy.lastCall.args[0], ['git', 'push', '--set-upstream', 'upstream', 'foo']);
    t.regex(await spy.lastCall.returnValue, /Branch .?foo.? set up to track remote branch .?foo.? from .?upstream.?/);
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

test.serial('should roll back when cancelled', async t => {
  sh.exec('git init');
  sh.exec(`git remote add origin foo`);
  const version = '1.2.3';
  gitAdd(`{"version":"${version}"}`, 'package.json', 'Add package.json');
  const options = { git: { requireCleanWorkingDir: true, commit: true, tag: true, tagName: 'v${version}' } };
  const gitClient = factory(Git, { options });
  const exec = sinon.spy(gitClient.shell, 'execFormattedCommand');
  sh.exec(`git tag ${version}`);
  gitAdd('line', 'file', 'Add file');

  await gitClient.init();

  sh.exec('npm --no-git-tag-version version patch');

  gitClient.bump('1.2.4');
  await gitClient.beforeRelease();
  await gitClient.stage('package.json');
  await gitClient.commit({ message: 'Add this' });
  await gitClient.tag();
  await gitClient.rollbackOnce();

  t.is(exec.args[10][0], 'git tag --delete v1.2.4');
  t.is(exec.args[11][0], 'git reset --hard HEAD~1');
});

test.serial('should not touch existing history when rolling back', async t => {
  sh.exec('git init');
  const version = '1.2.3';
  gitAdd(`{"version":"${version}"}`, 'package.json', 'Add package.json');
  const options = { git: { requireCleanWorkingDir: true, commit: true, tag: true } };
  const gitClient = factory(Git, { options });
  sh.exec(`git tag ${version}`);

  const exec = sinon.spy(gitClient.shell, 'execFormattedCommand');
  gitClient.config.setContext({ version: '1.2.4' });
  await gitClient.beforeRelease();
  await gitClient.commit();
  await gitClient.rollbackOnce();

  t.is(exec.args[3][0], 'git reset --hard HEAD');
});

test.serial('should not roll back with risky config', async t => {
  sh.exec('git init');
  const options = { git: { requireCleanWorkingDir: false, commit: true, tag: true } };
  const gitClient = factory(Git, { options });
  await gitClient.beforeRelease();
  t.is('rollbackOnce' in gitClient, false);
});
