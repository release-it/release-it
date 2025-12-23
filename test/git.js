import test, { beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import { EOL } from 'node:os';
import childProcess from 'node:child_process';
import { appendFileSync } from 'node:fs';
import Git from '../lib/plugin/git/Git.js';
import { execOpts, touch } from '../lib/util.js';
import sh from './util/sh.js';
import { factory } from './util/index.js';
import { mkTmpDir, readFile, gitAdd } from './util/helpers.js';

describe('git', () => {
  beforeEach(() => {
    const tmp = mkTmpDir();
    process.chdir(tmp);
  });

  test('should return whether repo has upstream branch', async () => {
    const gitClient = await factory(Git);
    childProcess.execSync('git init', execOpts);
    gitAdd('line', 'file', 'Add file');
    assert.equal(await gitClient.hasUpstreamBranch(), false);
  });

  test('should return branch name', async () => {
    const gitClient = await factory(Git);
    childProcess.execSync('git init', execOpts);
    assert.equal(await gitClient.getBranchName(), null);
    childProcess.execSync('git checkout -b feat', execOpts);
    gitAdd('line', 'file', 'Add file');
    assert.equal(await gitClient.getBranchName(), 'feat');
  });

  test('should return whether tag exists and if working dir is clean', async () => {
    const gitClient = await factory(Git);
    childProcess.execSync('git init', execOpts);
    assert.equal(await gitClient.tagExists('1.0.0'), false);
    touch('file');
    assert.equal(await gitClient.isWorkingDirClean(), false);
    gitAdd('line', 'file', 'Add file');
    childProcess.execSync('git tag 1.0.0', execOpts);
    assert(await gitClient.tagExists('1.0.0'));
    assert(await gitClient.isWorkingDirClean());
  });

  test('should throw if tag exists', async () => {
    const gitClient = await factory(Git);
    childProcess.execSync('git init', execOpts);
    touch('file');
    gitAdd('line', 'file', 'Add file');
    childProcess.execSync('git tag 0.0.2', execOpts);
    gitClient.config.setContext({ latestTag: '0.0.1', tagName: '0.0.2' });
    await assert.rejects(gitClient.tag({ name: '0.0.2' }), /fatal: tag '0\.0\.2' already exists/);
  });

  test('should only warn if tag exists intentionally', async t => {
    const gitClient = await factory(Git);
    const warn = t.mock.method(gitClient.log, 'warn');
    childProcess.execSync('git init', execOpts);
    touch('file');
    gitAdd('line', 'file', 'Add file');
    childProcess.execSync('git tag 1.0.0', execOpts);
    gitClient.config.setContext({ latestTag: '1.0.0', tagName: '1.0.0' });
    await assert.doesNotReject(gitClient.tag());
    assert.equal(warn.mock.callCount(), 1);
    assert.equal(warn.mock.calls[0].arguments[0], 'Tag "1.0.0" already exists');
  });

  test('should return the remote url', async () => {
    childProcess.execSync(`git init`, execOpts);
    {
      const options = { git: { pushRepo: 'origin' } };
      const gitClient = await factory(Git, { options });
      assert.equal(await gitClient.getRemoteUrl(), null);
      childProcess.execSync(`git remote add origin foo`, execOpts);
      assert.equal(await gitClient.getRemoteUrl(), 'foo');
    }
    {
      const options = { git: { pushRepo: 'another' } };
      const gitClient = await factory(Git, { options });
      assert.equal(await gitClient.getRemoteUrl(), null);
      childProcess.execSync(`git remote add another bar`, execOpts);
      assert.equal(await gitClient.getRemoteUrl(), 'bar');
    }
    {
      const options = { git: { pushRepo: 'git://github.com/webpro/release-it.git' } };
      const gitClient = await factory(Git, { options });
      assert.equal(await gitClient.getRemoteUrl(), 'git://github.com/webpro/release-it.git');
    }
  });

  test('should return the non-origin remote', async () => {
    const bare = mkTmpDir();
    childProcess.execSync(`git init --bare ${bare}`, execOpts);
    childProcess.execSync(`git clone ${bare} .`, execOpts);
    gitAdd('line', 'file', 'Add file');
    childProcess.execSync('git remote rename origin upstream', execOpts);
    const gitClient = await factory(Git);
    assert.equal(await gitClient.getRemoteUrl(), bare);
  });

  test('should stage, commit, tag and push', async () => {
    const bare = mkTmpDir();
    childProcess.execSync(`git init --bare ${bare}`, execOpts);
    childProcess.execSync(`git clone ${bare} .`, execOpts);
    const version = '1.2.3';
    gitAdd(`{"version":"${version}"}`, 'package.json', 'Add package.json');
    {
      const gitClient = await factory(Git);
      childProcess.execSync(`git tag ${version}`, execOpts);
      assert.equal(await gitClient.getLatestTagName(), version);
    }
    {
      const gitClient = await factory(Git);
      gitAdd('line', 'file', 'Add file');
      childProcess.execSync('npm --no-git-tag-version version patch', execOpts);
      await gitClient.stage('package.json');
      await gitClient.commit({ message: `Release v1.2.4` });
      await gitClient.tag({ name: 'v1.2.4', annotation: 'Release v1.2.4' });
      assert.equal(await gitClient.getLatestTagName(), 'v1.2.4');
      await gitClient.push();
      const stdout = childProcess.execSync('git status -uno', { encoding: 'utf-8' });
      assert.match(stdout, /nothing to commit/);
    }
  });

  test('should commit, tag and push with extra args', async t => {
    const bare = mkTmpDir();
    childProcess.execSync(`git init --bare ${bare}`, execOpts);
    childProcess.execSync(`git clone ${bare} .`, execOpts);
    gitAdd('line', 'file', 'Add file');
    const options = { git: { commitArgs: '-S', tagArgs: ['-T', 'foo'], pushArgs: ['-U', 'bar', '-V'] } };
    const gitClient = await factory(Git, { options });
    const stub = t.mock.method(gitClient.shell, 'exec', () => Promise.resolve());
    await gitClient.stage('package.json');
    await gitClient.commit({ message: `Release v1.2.4` });
    await gitClient.tag({ name: 'v1.2.4', annotation: 'Release v1.2.4' });
    await gitClient.push();
    assert(stub.mock.calls[1].arguments[0].includes('-S'));
    assert.equal(stub.mock.calls[2].arguments[0][5], '-T');
    assert.equal(stub.mock.calls[2].arguments[0][6], 'foo');
    assert(stub.mock.calls.at(-1).arguments[0].join(' ').includes('-U bar -V'));
  });

  test('should amend commit without message if not provided', async t => {
    const bare = mkTmpDir();
    childProcess.execSync(`git init --bare ${bare}`, execOpts);
    childProcess.execSync(`git clone ${bare} .`, execOpts);
    gitAdd('line', 'file', 'Add file');
    const options = { git: { commitArgs: ['--amend', '--no-edit', '--no-verify'] } };
    const gitClient = await factory(Git, { options });
    const exec = t.mock.method(gitClient.shell, 'exec', () => Promise.resolve());
    await gitClient.stage('package.json');
    await gitClient.commit();
    assert.deepEqual(exec.mock.calls[1].arguments[0], ['git', 'commit', '--amend', '--no-edit', '--no-verify']);
  });

  test('should commit and tag with quoted characters', async () => {
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
      assert.equal(stdout.trim(), 'Release 1.0.0');
    }
    {
      const stdout = childProcess.execSync('git tag -n99', { encoding: 'utf-8' });
      assert.equal(
        stdout.trim(),
        `1.0.0           Release 1.0.0\n    \n    - Foo's\n    - "$bar"\n    - '$baz'\n    - foo`
      );
    }
  });

  test('should push to origin', async t => {
    const bare = mkTmpDir();
    childProcess.execSync(`git init --bare ${bare}`, execOpts);
    childProcess.execSync(`git clone ${bare} .`, execOpts);
    gitAdd('line', 'file', 'Add file');
    const gitClient = await factory(Git);
    const spy = t.mock.method(gitClient.shell, 'exec');
    await gitClient.push();
    assert.deepEqual(spy.mock.calls.at(-1).arguments[0], ['git', 'push']);
    const stdout = childProcess.execSync('git ls-tree -r HEAD --name-only', {
      cwd: bare,
      encoding: 'utf-8'
    });
    assert.equal(stdout.trim(), 'file');
  });

  test('should push to tracked upstream branch', async t => {
    const bare = mkTmpDir();
    childProcess.execSync(`git init --bare ${bare}`, execOpts);
    childProcess.execSync(`git clone ${bare} .`, execOpts);
    childProcess.execSync(`git remote rename origin upstream`, execOpts);
    gitAdd('line', 'file', 'Add file');
    const gitClient = await factory(Git);
    const spy = t.mock.method(gitClient.shell, 'exec');
    await gitClient.push();
    assert.deepEqual(spy.mock.calls.at(-1).arguments[0], ['git', 'push']);
    const stdout = childProcess.execSync('git ls-tree -r HEAD --name-only', {
      cwd: bare,
      encoding: 'utf-8'
    });
    assert.equal(stdout.trim(), 'file');
  });

  test('should push to repo url', async t => {
    const bare = mkTmpDir();
    childProcess.execSync(`git init --bare ${bare}`, execOpts);
    childProcess.execSync(`git clone ${bare} .`, execOpts);
    gitAdd('line', 'file', 'Add file');
    const options = { git: { pushRepo: 'https://host/repo.git' } };
    const gitClient = await factory(Git, { options });
    const spy = t.mock.method(gitClient.shell, 'exec');
    try {
      await gitClient.push();
    } catch (err) {
      assert.deepEqual(spy.mock.calls.at(-1).arguments[0], ['git', 'push', 'https://host/repo.git']);
    }
  });

  test('should push to remote name (not "origin")', async t => {
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
    const spy = t.mock.method(gitClient.shell, 'exec');
    await gitClient.push();
    assert.deepEqual(spy.mock.calls.at(-1).arguments[0], ['git', 'push', 'upstream']);
    const stdout = childProcess.execSync('git ls-tree -r HEAD --name-only', {
      cwd: bare,
      encoding: 'utf-8'
    });
    assert.equal(stdout.trim(), 'file');

    {
      childProcess.execSync(`git checkout -b foo`, execOpts);
      gitAdd('line', 'file', 'Add file');
      await gitClient.push();
      assert.deepEqual(spy.mock.calls.at(-1).arguments[0], ['git', 'push', '--set-upstream', 'upstream', 'foo']);
      assert.match(
        await spy.mock.calls.at(-1).result,
        /branch .?foo.? set up to track (remote branch .?foo.? from .?upstream.?|.?upstream\/foo.?)/i
      );
    }
  });

  test('should return repo status', async () => {
    const gitClient = await factory(Git);
    childProcess.execSync('git init', execOpts);
    gitAdd('line', 'file1', 'Add file');

    appendFileSync('file1', 'line');

    appendFileSync('file2', 'line');
    childProcess.execSync('git add file2', execOpts);
    assert.equal(await gitClient.status(), ' M file1\nA  file2');
  });

  test('should reset files', async t => {
    const gitClient = await factory(Git);
    childProcess.execSync('git init', execOpts);
    gitAdd('line', 'file', 'Add file');

    appendFileSync('file', 'line');
    assert.match(await readFile('file'), /^line\s*line\s*$/);
    await gitClient.reset('file');
    assert.match(await readFile('file'), /^line\s*$/);
    const warn = t.mock.method(gitClient.log, 'warn');
    await gitClient.reset(['file2, file3']);
    assert.match(warn.mock.calls[0].arguments[0], /Could not reset file2, file3/);
  });

  test('should roll back when cancelled', async t => {
    childProcess.execSync('git init', execOpts);
    childProcess.execSync(`git remote add origin file://foo`, execOpts);
    const version = '1.2.3';
    gitAdd(`{"version":"${version}"}`, 'package.json', 'Add package.json');
    const options = { git: { requireCleanWorkingDir: true, commit: true, tag: true, tagName: 'v${version}' } };
    const gitClient = await factory(Git, { options });
    const exec = t.mock.method(gitClient.shell, 'execFormattedCommand');
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

    assert.equal(exec.mock.calls[11].arguments[0], 'git tag --delete v1.2.4');
    assert.equal(exec.mock.calls[12].arguments[0], 'git reset --hard HEAD~1');
  });

  // To get this test to pass, I had to switch between spawnsync and execsync somehow
  test('should remove remote tag when push to branch failed', async t => {
    childProcess.execSync('git init', execOpts);
    childProcess.execSync(`git remote add origin file://foo`, execOpts);
    sh.exec(`git remote update`, execOpts);
    const version = '1.2.3';
    gitAdd(`{"version":"${version}"}`, 'package.json', 'Add package.json');
    const options = { git: { requireCleanWorkingDir: true, commit: true, tag: true, tagName: 'v${version}' } };
    const gitClient = await factory(Git, { options });
    const exec = t.mock.method(gitClient.shell, 'execFormattedCommand');
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
    assert.equal(exec.mock.calls[15].arguments[0], 'git push origin --delete v1.2.4');
  });

  test('should not touch existing history when rolling back', async t => {
    childProcess.execSync('git init', execOpts);
    const version = '1.2.3';
    gitAdd(`{"version":"${version}"}`, 'package.json', 'Add package.json');
    const options = { git: { requireCleanWorkingDir: true, commit: true, tag: true } };
    const gitClient = await factory(Git, { options });
    childProcess.execSync(`git tag ${version}`, execOpts);

    const exec = t.mock.method(gitClient.shell, 'execFormattedCommand');
    gitClient.config.setContext({ version: '1.2.4' });
    await gitClient.beforeRelease();
    await gitClient.commit();
    await gitClient.rollbackOnce();

    assert.equal(exec.mock.calls[3].arguments[0], 'git reset --hard HEAD');
  });

  test.skip('should not roll back with risky config', async () => {
    childProcess.execSync('git init', execOpts);
    const options = { git: { requireCleanWorkingDir: false, commit: true, tag: true } };
    const gitClient = await factory(Git, { options });
    await gitClient.beforeRelease();
    assert.equal('rollbackOnce' in gitClient, false);
  });

  test('should return latest tag from default branch (not parent commit)', async () => {
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
      assert.equal(await gitClient.getLatestTagName(), '1.1.0');
    }

    {
      const options = { git: { getLatestTagFromAllRefs: false } };
      const gitClient = await factory(Git, { options });
      assert.equal(await gitClient.getLatestTagName(), '1.1.0-rc.1');
    }
  });
});
