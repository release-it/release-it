import childProcess from 'node:child_process';
import test, { beforeEach, describe } from 'node:test';
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
import Shell from '../lib/shell.js';
import Git from '../lib/plugin/git/Git.js';
import { execOpts, readJSON } from '../lib/util.js';
import sh from './util/sh.js';
import { factory } from './util/index.js';
import { mkTmpDir, gitAdd } from './util/helpers.js';

describe('git.init', () => {
  const { git } = readJSON(new URL('../config/release-it.json', import.meta.url));

  let bare;
  let target;
  beforeEach(() => {
    bare = mkTmpDir();
    target = mkTmpDir();
    process.chdir(bare);
    sh.exec(`git init --bare .`, execOpts);
    sh.exec(`git clone ${bare} ${target}`, execOpts);
    process.chdir(target);
    gitAdd('line', 'file', 'Add file');
  });

  test('should throw if on wrong branch', async () => {
    const options = { git: { requireBranch: 'dev' } };
    const gitClient = await factory(Git, { options });
    childProcess.execSync('git remote remove origin', execOpts);
    await assert.rejects(gitClient.init(), /Must be on branch dev/);
  });

  test('should throw if on negated branch', async () => {
    const options = { git: { requireBranch: '!main' } };
    const gitClient = await factory(Git, { options });
    sh.exec('git checkout -b main', execOpts);
    await assert.rejects(gitClient.init(), /Must be on branch !main/);
  });

  test('should not throw if required branch matches', async () => {
    const options = { git: { requireBranch: 'ma?*' } };
    const gitClient = await factory(Git, { options });
    await assert.doesNotReject(gitClient.init());
  });

  test('should not throw if one of required branch matches', async () => {
    const options = { git: { requireBranch: ['release/*', 'hotfix/*'] } };
    const gitClient = await factory(Git, { options });
    childProcess.execSync('git checkout -b release/v1', execOpts);
    await assert.doesNotReject(gitClient.init());
  });

  test('should throw if there is no remote Git url', async () => {
    const gitClient = await factory(Git, { options: { git } });
    childProcess.execSync('git remote remove origin', execOpts);
    await assert.rejects(gitClient.init(), /Could not get remote Git url/);
  });

  test('should throw if working dir is not clean', async () => {
    const gitClient = await factory(Git, { options: { git } });
    childProcess.execSync('rm file', execOpts);
    await assert.rejects(gitClient.init(), /Working dir must be clean/);
  });

  test('should throw if no upstream is configured', async () => {
    const gitClient = await factory(Git, { options: { git } });
    childProcess.execSync('git checkout -b foo', execOpts);
    await assert.rejects(gitClient.init(), /No upstream configured for current branch/);
  });

  test('should throw if there are no commits', async () => {
    const options = { git: { requireCommits: true } };
    const gitClient = await factory(Git, { options });
    childProcess.execSync('git tag 1.0.0', execOpts);
    await assert.rejects(gitClient.init(), /There are no commits since the latest tag/);
  });

  test('should not throw if there are commits', async () => {
    const options = { git: { requireCommits: true } };
    const gitClient = await factory(Git, { options });
    childProcess.execSync('git tag 1.0.0', execOpts);
    gitAdd('line', 'file', 'Add file');
    await assert.doesNotReject(gitClient.init(), 'There are no commits since the latest tag');
  });

  test('should fail (exit code 1) if there are no commits', async () => {
    const options = { git: { requireCommits: true } };
    const gitClient = await factory(Git, { options });
    childProcess.execSync('git tag 1.0.0', execOpts);
    await assert.rejects(gitClient.init(), { code: 1 });
  });

  test('should not fail (exit code 0) if there are no commits', async () => {
    const options = { git: { requireCommits: true, requireCommitsFail: false } };
    const gitClient = await factory(Git, { options });
    childProcess.execSync('git tag 1.0.0', execOpts);
    await assert.rejects(gitClient.init(), { code: 0 });
  });

  test('should throw if there are no commits in specified path', async () => {
    const options = { git: { requireCommits: true, commitsPath: 'dir' } };
    const gitClient = await factory(Git, { options });
    mkdirSync('dir', { recursive: true });
    sh.exec('git tag 1.0.0', execOpts);
    await assert.rejects(gitClient.init(), { message: /^There are no commits since the latest tag/ });
  });

  test('should not throw if there are commits in specified path', async () => {
    const options = { git: { requireCommits: true, commitsPath: 'dir' } };
    const gitClient = await factory(Git, { options });
    sh.exec('git tag 1.0.0', execOpts);
    gitAdd('line', 'dir/file', 'Add file');
    await assert.doesNotReject(gitClient.init());
  });

  test('should not throw if there are no tags', async () => {
    const options = { git: { requireCommits: true } };
    const gitClient = await factory(Git, { options });
    gitAdd('line', 'file', 'Add file');
    await assert.doesNotReject(gitClient.init());
  });

  test('should not throw if origin remote is renamed', async () => {
    childProcess.execSync('git remote rename origin upstream', execOpts);
    const gitClient = await factory(Git);
    await assert.doesNotReject(gitClient.init());
  });

  test('should detect and include version prefix ("v")', async () => {
    const gitClient = await factory(Git, { options: { git } });
    childProcess.execSync('git tag v1.0.0', execOpts);
    await gitClient.init();
    await gitClient.bump('1.0.1');
    assert.equal(gitClient.config.getContext('tagName'), 'v1.0.1');
  });

  test('should detect and exclude version prefix', async () => {
    const gitClient = await factory(Git, { options: { git } });
    childProcess.execSync('git tag 1.0.0', execOpts);
    await gitClient.init();
    await gitClient.bump('1.0.1');
    assert.equal(gitClient.config.getContext('tagName'), '1.0.1');
  });

  test('should detect and exclude version prefix (configured)', async () => {
    const gitClient = await factory(Git, { options: { git: { tagName: 'v${version}' } } });
    childProcess.execSync('git tag 1.0.0', execOpts);
    await gitClient.init();
    await gitClient.bump('1.0.1');
    assert.equal(gitClient.config.getContext('tagName'), 'v1.0.1');
  });

  test('should honor custom tagName configuration', async () => {
    const gitClient = await factory(Git, { options: { git: { tagName: 'TAGNAME-${repo.project}-v${version}' } } });
    childProcess.execSync('git tag 1.0.0', execOpts);
    await gitClient.init();
    await gitClient.bump('1.0.1');
    const { project } = gitClient.getContext('repo');
    assert.equal(gitClient.config.getContext('tagName'), `TAGNAME-${project}-v1.0.1`);
  });

  test('should get the latest tag after fetch', async () => {
    const shell = await factory(Shell);
    const gitClient = await factory(Git, { container: { shell } });
    const other = mkTmpDir();
    childProcess.execSync('git push', execOpts);
    childProcess.execSync(`git clone ${bare} ${other}`, execOpts);

    process.chdir(other);
    childProcess.execSync('git tag 1.0.0', execOpts);
    childProcess.execSync('git push --tags', execOpts);
    process.chdir(target);
    await gitClient.init();
    assert.equal(gitClient.config.getContext('latestTag'), '1.0.0');
  });

  test('should get the latest custom tag after fetch when tagName is configured', async () => {
    const shell = await factory(Shell);
    const gitClient = await factory(Git, {
      options: { git: { tagName: 'TAGNAME-v${version}' } },
      container: { shell }
    });
    const other = mkTmpDir();
    childProcess.execSync('git push', execOpts);
    childProcess.execSync(`git clone ${bare} ${other}`, execOpts);
    process.chdir(other);
    childProcess.execSync('git tag TAGNAME-OTHER-v2.0.0', execOpts);
    childProcess.execSync('git tag TAGNAME-v1.0.0', execOpts);
    childProcess.execSync('git tag TAGNAME-OTHER-v2.0.2', execOpts);
    childProcess.execSync('git push --tags', execOpts);
    process.chdir(target);
    await gitClient.init();
    assert.equal(gitClient.config.getContext('latestTag'), 'TAGNAME-v1.0.0');
  });

  test('should get the latest tag based on tagMatch', async () => {
    const shell = await factory(Shell);
    const gitClient = await factory(Git, {
      options: { git: { tagMatch: '[0-9][0-9]\\.[0-1][0-9]\\.[0-9]*' } },
      container: { shell }
    });
    childProcess.execSync('git tag 1.0.0', execOpts);
    childProcess.execSync('git tag 21.04.3', execOpts);
    childProcess.execSync('git tag 1.0.1', execOpts);
    childProcess.execSync('git push --tags', execOpts);
    await gitClient.init();
    assert.equal(gitClient.config.getContext('latestTag'), '21.04.3');
  });

  test('should get the latest tag based on tagExclude', async () => {
    const shell = await factory(Shell);
    const gitClient = await factory(Git, {
      options: { git: { tagExclude: '*[-]*' } },
      container: { shell }
    });
    childProcess.execSync('git tag 1.0.0', execOpts);
    childProcess.execSync('git commit --allow-empty -m "commit 1"', execOpts);
    childProcess.execSync('git tag 1.0.1-rc.0', execOpts);
    childProcess.execSync('git tag 1.0.1', execOpts);
    childProcess.execSync('git commit --allow-empty -m "commit 2"', execOpts);
    childProcess.execSync('git tag 1.1.0-rc.0', execOpts);
    childProcess.execSync('git push --tags', execOpts);
    await gitClient.init();
    assert.equal(gitClient.config.getContext('latestTag'), '1.0.1');
  });

  test('should generate correct changelog', async () => {
    const gitClient = await factory(Git, { options: { git } });
    childProcess.execSync('git tag 1.0.0', execOpts);
    gitAdd('line', 'file', 'Add file');
    gitAdd('line', 'file', 'Add file');
    await gitClient.init();
    const changelog = await gitClient.getChangelog();
    assert.match(changelog, /\* Add file \(\w{7}\)\n\* Add file \(\w{7}\)/);
  });

  test('should get the full changelog since latest major tag', async () => {
    const shell = await factory(Shell);
    const gitClient = await factory(Git, {
      options: { git: { tagMatch: '[0-9]\\.[0-9]\\.[0-9]', changelog: git.changelog } },
      container: { shell }
    });
    childProcess.execSync('git tag 1.0.0', execOpts);
    gitAdd('line', 'file', 'Add file');
    childProcess.execSync('git tag 2.0.0-rc.0', execOpts);
    gitAdd('line', 'file', 'Add file');
    childProcess.execSync('git tag 2.0.0-rc.1', execOpts);
    gitAdd('line', 'file', 'Add file');
    await gitClient.init();
    assert.equal(gitClient.config.getContext('latestTag'), '1.0.0');
    const changelog = await gitClient.getChangelog();
    assert.match(changelog, /\* Add file \(\w{7}\)\n\* Add file \(\w{7}\)\n\* Add file \(\w{7}\)/);
  });
});
