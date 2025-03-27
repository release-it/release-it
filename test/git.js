import { EOL } from 'node:os';
import childProcess from 'node:child_process';
import { appendFileSync } from 'node:fs';
import test from 'ava';
import sinon from 'sinon';
import Git from '../lib/plugin/git/Git.js';
import { execOpts, touch } from '../lib/util.js';
import sh from './util/sh.js';
import { factory } from './util/index.js';
import { mkTmpDir, readFile, gitAdd } from './util/helpers.js';

test.beforeEach(() => {
  const tmp = mkTmpDir();
  process.chdir(tmp);
});

test.serial('should return whether repo has upstream branch', async t => {
  const gitClient = await factory(Git);
  childProcess.execSync('git init', execOpts);
  gitAdd('line', 'file', 'Add file');
  t.false(await gitClient.hasUpstreamBranch());
});

test.serial('should return branch name', async t => {
  const gitClient = await factory(Git);
  childProcess.execSync('git init', execOpts);
  t.is(await gitClient.getBranchName(), null);
  childProcess.execSync('git checkout -b feat', execOpts);
  gitAdd('line', 'file', 'Add file');
  t.is(await gitClient.getBranchName(), 'feat');
});

test.serial('should return whether tag exists and if working dir is clean', async t => {
  const gitClient = await factory(Git);
  childProcess.execSync('git init', execOpts);
  t.false(await gitClient.tagExists('1.0.0'));
  touch('file');
  t.false(await gitClient.isWorkingDirClean());
  gitAdd('line', 'file', 'Add file');
  childProcess.execSync('git tag 1.0.0', execOpts);
  t.true(await gitClient.tagExists('1.0.0'));
  t.true(await gitClient.isWorkingDirClean());
});

test.serial('should throw if tag exists', async t => {
  const gitClient = await factory(Git);
  childProcess.execSync('git init', execOpts);
  touch('file');
  gitAdd('line', 'file', 'Add file');
  childProcess.execSync('git tag 0.0.2', execOpts);
  gitClient.config.setContext({ latestTag: '0.0.1', tagName: '0.0.2' });
  const expected = { instanceOf: Error, message: /fatal: tag '0\.0\.2' already exists/ };
  await t.throwsAsync(gitClient.tag({ name: '0.0.2' }), expected);
});

test.serial('should only warn if tag exists intentionally', async t => {
  const gitClient = await factory(Git);
  const { warn } = gitClient.log;
  childProcess.execSync('git init', execOpts);
  touch('file');
  gitAdd('line', 'file', 'Add file');
  childProcess.execSync('git tag 1.0.0', execOpts);
  gitClient.config.setContext({ latestTag: '1.0.0', tagName: '1.0.0' });
  await t.notThrowsAsync(gitClient.tag());
  t.is(warn.callCount, 1);
  t.is(warn.firstCall.args[0], 'Tag "1.0.0" already exists');
});

test.serial('should return the remote url', async t => {
  childProcess.execSync(`git init`, execOpts);
  {
    const options = { git: { pushRepo: 'origin' } };
    const gitClient = await factory(Git, { options });
    t.is(await gitClient.getRemoteUrl(), null);
    childProcess.execSync(`git remote add origin foo`, execOpts);
    t.is(await gitClient.getRemoteUrl(), 'foo');
  }
  {
    const options = { git: { pushRepo: 'another' } };
    const gitClient = await factory(Git, { options });
    t.is(await gitClient.getRemoteUrl(), null);
    childProcess.execSync(`git remote add another bar`, execOpts);
    t.is(await gitClient.getRemoteUrl(), 'bar');
  }
  {
    const options = { git: { pushRepo: 'git://github.com/webpro/release-it.git' } };
    const gitClient = await factory(Git, { options });
    t.is(await gitClient.getRemoteUrl(), 'git://github.com/webpro/release-it.git');
  }
});

test.serial('should return the non-origin remote', async t => {
  const bare = mkTmpDir();
  childProcess.execSync(`git init --bare ${bare}`, execOpts);
  childProcess.execSync(`git clone ${bare} .`, execOpts);
  gitAdd('line', 'file', 'Add file');
  childProcess.execSync('git remote rename origin upstream', execOpts);
  const gitClient = await factory(Git);
  t.is(await gitClient.getRemoteUrl(), bare);
});

test.serial('should stage, commit, tag and push', async t => {
  const bare = mkTmpDir();
  childProcess.execSync(`git init --bare ${bare}`, execOpts);
  childProcess.execSync(`git clone ${bare} .`, execOpts);
  const version = '1.2.3';
  gitAdd(`{"version":"${version}"}`, 'package.json', 'Add package.json');
  {
    const gitClient = await factory(Git);
    childProcess.execSync(`git tag ${version}`, execOpts);
    t.is(await gitClient.getLatestTagName(), version);
  }
  {
    const gitClient = await factory(Git);
    gitAdd('line', 'file', 'Add file');
    childProcess.execSync('npm --no-git-tag-version version patch', execOpts);
    await gitClient.stage('package.json');
    await gitClient.commit({ message: `Release v1.2.4` });
    await gitClient.tag({ name: 'v1.2.4', annotation: 'Release v1.2.4' });
    t.is(await gitClient.getLatestTagName(), 'v1.2.4');
    await gitClient.push();
    const stdout = childProcess.execSync('git status -uno', { encoding: 'utf-8' });

    t.true(stdout.includes('nothing to commit'));
  }
});

test.serial('should commit, tag and push with extra args', async t => {
  const bare = mkTmpDir();
  childProcess.execSync(`git init --bare ${bare}`, execOpts);
  childProcess.execSync(`git clone ${bare} .`, execOpts);
  gitAdd('line', 'file', 'Add file');
  const options = { git: { commitArgs: '-S', tagArgs: ['-T', 'foo'], pushArgs: ['-U', 'bar', '-V'] } };
  const gitClient = await factory(Git, { options });
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

test.serial('should amend commit without message if not provided', async t => {
  const bare = mkTmpDir();
  childProcess.execSync(`git init --bare ${bare}`, execOpts);
  childProcess.execSync(`git clone ${bare} .`, execOpts);
  gitAdd('line', 'file', 'Add file');
  const options = { git: { commitArgs: ['--amend', '--no-edit', '--no-verify'] } };
  const gitClient = await factory(Git, { options });
  const stub = sinon.stub(gitClient.shell, 'exec').resolves();
  await gitClient.stage('package.json');
  await gitClient.commit();
  t.deepEqual(stub.secondCall.args[0], ['git', 'commit', '--amend', '--no-edit', '--no-verify']);
  stub.restore();
});

test.serial('should commit and tag with quoted characters', async t => {
  const bare = mkTmpDir();
  childProcess.execSync(`git init --bare ${bare}`, execOpts);
  childProcess.execSync(`git clone ${bare} .`, execOpts);
  const gitClient = await factory(Git, {
    options: { git: { commitMessage: 'Release ${version}', tagAnnotation: 'Release ${version}\n\n${changelog}' } }
  });
  touch('file');
  const changelog = `- Foo's${EOL}- "$bar"${EOL}- '$baz'${EOL}- foo`;
  gitClient.config.setContext({ version: '1.0.0', changelog });

  await gitClient.stage('file');
  await gitClient.commit();
  await gitClient.tag({ name: '1.0.0' });
  await gitClient.push();
  {
    const stdout = childProcess.execSync('git log -1 --format=%s', { encoding: 'utf-8' });
    t.is(stdout.trim(), 'Release 1.0.0');
  }
  {
    const stdout = childProcess.execSync('git tag -n99', { encoding: 'utf-8' });
    t.is(stdout.trim(), `1.0.0           Release 1.0.0\n    \n    - Foo's\n    - "$bar"\n    - '$baz'\n    - foo`);
  }
});

test.serial('should push to origin', async t => {
  const bare = mkTmpDir();
  childProcess.execSync(`git init --bare ${bare}`, execOpts);
  childProcess.execSync(`git clone ${bare} .`, execOpts);
  gitAdd('line', 'file', 'Add file');
  const gitClient = await factory(Git);
  const spy = sinon.spy(gitClient.shell, 'exec');
  await gitClient.push();
  t.deepEqual(spy.lastCall.args[0], ['git', 'push']);
  const stdout = childProcess.execSync('git ls-tree -r HEAD --name-only', {
    cwd: bare,
    encoding: 'utf-8'
  });
  t.is(stdout.trim(), 'file');

  spy.restore();
});

test.serial('should push to tracked upstream branch', async t => {
  const bare = mkTmpDir();
  childProcess.execSync(`git init --bare ${bare}`, execOpts);
  childProcess.execSync(`git clone ${bare} .`, execOpts);
  childProcess.execSync(`git remote rename origin upstream`, execOpts);
  gitAdd('line', 'file', 'Add file');
  const gitClient = await factory(Git);
  const spy = sinon.spy(gitClient.shell, 'exec');
  await gitClient.push();
  t.deepEqual(spy.lastCall.args[0], ['git', 'push']);
  const stdout = childProcess.execSync('git ls-tree -r HEAD --name-only', {
    cwd: bare,
    encoding: 'utf-8'
  });
  t.is(stdout.trim(), 'file');

  spy.restore();
});

test.serial('should push to repo url', async t => {
  const bare = mkTmpDir();
  childProcess.execSync(`git init --bare ${bare}`, execOpts);
  childProcess.execSync(`git clone ${bare} .`, execOpts);
  gitAdd('line', 'file', 'Add file');
  const options = { git: { pushRepo: 'https://host/repo.git' } };
  const gitClient = await factory(Git, { options });
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
  childProcess.execSync(`git init --bare ${bare}`, execOpts);
  childProcess.execSync(`git clone ${bare} .`, execOpts);
  gitAdd('line', 'file', 'Add file');
  childProcess.execSync(
    `git remote add upstream ${childProcess.execSync('git config --get remote.origin.url', {
      encoding: 'utf-8'
    })}`,
    execOpts
  );
  const options = { git: { pushRepo: 'upstream' } };
  const gitClient = await factory(Git, { options });
  const spy = sinon.spy(gitClient.shell, 'exec');
  await gitClient.push();
  t.deepEqual(spy.lastCall.args[0], ['git', 'push', 'upstream']);
  const stdout = childProcess.execSync('git ls-tree -r HEAD --name-only', {
    cwd: bare,
    encoding: 'utf-8'
  });
  t.is(stdout.trim(), 'file');

  {
    childProcess.execSync(`git checkout -b foo`, execOpts);
    gitAdd('line', 'file', 'Add file');
    await gitClient.push();
    t.deepEqual(spy.lastCall.args[0], ['git', 'push', '--set-upstream', 'upstream', 'foo']);
    t.regex(
      await spy.lastCall.returnValue,
      /branch .?foo.? set up to track (remote branch .?foo.? from .?upstream.?|.?upstream\/foo.?)/i
    );
  }
  spy.restore();
});

test.serial('should return repo status', async t => {
  const gitClient = await factory(Git);
  childProcess.execSync('git init', execOpts);
  gitAdd('line', 'file1', 'Add file');

  appendFileSync('file1', 'line');

  appendFileSync('file2', 'line');
  childProcess.execSync('git add file2', execOpts);
  t.is(await gitClient.status(), ' M file1\nA  file2');
});

test.serial('should reset files', async t => {
  const gitClient = await factory(Git);
  childProcess.execSync('git init', execOpts);
  gitAdd('line', 'file', 'Add file');

  appendFileSync('file', 'line');
  t.regex(await readFile('file'), /^line\s*line\s*$/);
  await gitClient.reset('file');
  t.regex(await readFile('file'), /^line\s*$/);
  await gitClient.reset(['file2, file3']);
  t.regex(gitClient.log.warn.firstCall.args[0], /Could not reset file2, file3/);
});

test.serial('should roll back when cancelled', async t => {
  childProcess.execSync('git init', execOpts);
  childProcess.execSync(`git remote add origin file://foo`, execOpts);
  const version = '1.2.3';
  gitAdd(`{"version":"${version}"}`, 'package.json', 'Add package.json');
  const options = { git: { requireCleanWorkingDir: true, commit: true, tag: true, tagName: 'v${version}' } };
  const gitClient = await factory(Git, { options });
  const exec = sinon.spy(gitClient.shell, 'execFormattedCommand');
  childProcess.execSync(`git tag ${version}`, execOpts);
  gitAdd('line', 'file', 'Add file');

  await gitClient.init();

  childProcess.execSync('npm --no-git-tag-version version patch', execOpts);

  gitClient.bump('1.2.4');
  await gitClient.beforeRelease();
  await gitClient.stage('package.json');
  await gitClient.commit({ message: 'Add this' });
  await gitClient.tag();
  await gitClient.rollbackOnce();

  t.is(exec.args[11][0], 'git tag --delete v1.2.4');
  t.is(exec.args[12][0], 'git reset --hard HEAD~1');
});

// To get this test to pass, I had to switch between spawnsync and execsync somehow
test.serial('should remove remote tag when push to branch failed', async t => {
  childProcess.execSync('git init', execOpts);
  childProcess.execSync(`git remote add origin file://foo`, execOpts);
  sh.exec(`git remote update`, execOpts);
  const version = '1.2.3';
  gitAdd(`{"version":"${version}"}`, 'package.json', 'Add package.json');
  const options = { git: { requireCleanWorkingDir: true, commit: true, tag: true, tagName: 'v${version}' } };
  const gitClient = await factory(Git, { options });
  const exec = sinon.spy(gitClient.shell, 'execFormattedCommand');
  sh.exec(`git push`, execOpts);
  sh.exec(`git checkout HEAD~1`, execOpts);
  gitAdd('line', 'file', 'Add file');

  await gitClient.init();

  childProcess.execSync('npm --no-git-tag-version version patch', execOpts);

  gitClient.bump('1.2.4');
  await gitClient.beforeRelease();
  await gitClient.stage('package.json');
  await gitClient.commit({ message: 'Add this' });
  await gitClient.tag();
  try {
    await gitClient.push();
  } catch (e) {
    // push would fail with an error since HEAD is behind origin
  }
  t.is(exec.args[15][0], 'git push origin --delete v1.2.4');
});

test.serial('should not touch existing history when rolling back', async t => {
  childProcess.execSync('git init', execOpts);
  const version = '1.2.3';
  gitAdd(`{"version":"${version}"}`, 'package.json', 'Add package.json');
  const options = { git: { requireCleanWorkingDir: true, commit: true, tag: true } };
  const gitClient = await factory(Git, { options });
  childProcess.execSync(`git tag ${version}`, execOpts);

  const exec = sinon.spy(gitClient.shell, 'execFormattedCommand');
  gitClient.config.setContext({ version: '1.2.4' });
  await gitClient.beforeRelease();
  await gitClient.commit();
  await gitClient.rollbackOnce();

  t.is(exec.args[3][0], 'git reset --hard HEAD');
});

// eslint-disable-next-line ava/no-skip-test
test.serial.skip('should not roll back with risky config', async t => {
  childProcess.execSync('git init', execOpts);
  const options = { git: { requireCleanWorkingDir: false, commit: true, tag: true } };
  const gitClient = await factory(Git, { options });
  await gitClient.beforeRelease();
  t.is('rollbackOnce' in gitClient, false);
});

test.serial('should return latest tag from default branch (not parent commit)', async t => {
  childProcess.execSync('git init', execOpts);

  {
    const options = { git: { getLatestTagFromAllRefs: true } };
    const gitClient = await factory(Git, { options });
    gitAdd('main', 'file', 'Add file in main');
    const defaultBranchName = await gitClient.getBranchName();
    const developBranchName = 'develop';
    const featureBranchPrefix = 'feature';
    await gitClient.tag({ name: '1.0.0' });
    childProcess.execSync(`git branch ${developBranchName} ${defaultBranchName}`, execOpts);
    childProcess.execSync(`git checkout -b ${featureBranchPrefix}/first ${developBranchName}`, execOpts);
    gitAdd('feature/1', 'file', 'Update file in feature branch (1)');
    childProcess.execSync(`git checkout ${developBranchName}`, execOpts);
    childProcess.execSync(`git merge --no-ff ${featureBranchPrefix}/first`, execOpts);
    await gitClient.tag({ name: '1.1.0-rc.1' });
    childProcess.execSync(`git checkout ${defaultBranchName}`, execOpts);
    childProcess.execSync(`git merge --no-ff ${developBranchName}`, execOpts);
    await gitClient.tag({ name: '1.1.0' });
    childProcess.execSync(`git checkout -b ${featureBranchPrefix}/second ${developBranchName}`, execOpts);
    gitAdd('feature/2', 'file', 'Update file again, in feature branch (2)');
    childProcess.execSync(`git checkout ${developBranchName}`, execOpts);
    childProcess.execSync(`git merge --no-ff ${featureBranchPrefix}/second`, execOpts);
    t.is(await gitClient.getLatestTagName(), '1.1.0');
  }

  {
    const options = { git: { getLatestTagFromAllRefs: false } };
    const gitClient = await factory(Git, { options });
    t.is(await gitClient.getLatestTagName(), '1.1.0-rc.1');
  }
});
