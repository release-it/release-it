import test from 'tape';
import shell from 'shelljs';
import semver from 'semver';
import { config } from '../lib/config';
import { readJSON } from './util/index';
import { run, copy } from '../lib/shell';
import {
  isGitRepo,
  tagExists,
  getRemoteUrl,
  isWorkingDirClean,
  hasChanges,
  clone,
  stage,
  commit,
  tag,
  getLatestTag,
  push,
  getChangelog
} from '../lib/git';

const tmp = 'test/resources/tmp';

test('isGitRepo', async t => {
  t.ok(await isGitRepo());
  const notGitPath = '../';
  shell.pushd(notGitPath);
  t.notOk(await isGitRepo());
  shell.popd();
  t.end();
});

test('tagExists + isWorkingDirClean + hasChanges', async t => {
  shell.mkdir(tmp);
  shell.pushd(tmp);
  await run('git init');
  t.notOk(await tagExists('1.0.0'));
  await run('touch file1');
  t.notOk(await isWorkingDirClean());
  t.ok(await hasChanges());
  await run('git add file1');
  await run('git commit -am "Add file1"');
  await run('git tag 1.0.0');
  t.ok(await tagExists('1.0.0'));
  t.ok(await isWorkingDirClean());
  t.notOk(await hasChanges());
  shell.popd();
  shell.rm('-rf', tmp);
  t.end();
});

test('getRemoteUrl', async t => {
  shell.mkdir(tmp);
  shell.pushd(tmp);
  await run(`git init`);
  t.shouldReject(getRemoteUrl(), /Could not get remote Git url/);
  await run(`git remote add origin foo`);
  t.equal(await getRemoteUrl(), 'foo');
  shell.popd();
  shell.rm('-rf', tmp);
  t.end();
});

test('clone + stage + commit + tag + push', async t => {
  const tmpOrigin = 'test/resources/bare.git';
  await run(`git init --bare ${tmpOrigin}`);
  await clone(tmpOrigin, tmp);
  await copy('package.json', {}, tmp);
  shell.pushd(tmp);
  await stage('package.json');
  await commit('.', 'Add package.json');
  const pkgBefore = await readJSON('package.json');
  const versionBefore = pkgBefore.version;
  await run(`git tag ${versionBefore}`);
  const actual_latestTagBefore = await getLatestTag();
  t.ok(await isGitRepo());
  t.equal(versionBefore, actual_latestTagBefore);
  await run('echo line >> file1');
  await stage('file1');
  await commit('.', 'Update file1');
  await run('npm --no-git-tag-version version patch');
  await stage('package.json');
  const nextVersion = semver.inc(versionBefore, 'patch');
  await commit('.', 'Release v%s', nextVersion);
  await tag(nextVersion, 'v%s', 'Release v%');
  const pkgAfter = await readJSON('package.json');
  const actual_latestTagAfter = await getLatestTag();
  t.equal(pkgAfter.version, actual_latestTagAfter);
  await push();
  const status = await run('git status -uno');
  t.ok(status.includes('nothing to commit'));
  shell.popd();
  shell.rm('-rf', [tmpOrigin, tmp]);
  t.end();
});

test('getChangelog', async t => {
  shell.mkdir(tmp);
  shell.pushd(tmp);
  await run('git init');
  await run('echo line >> file && git add file && git commit -m "First commit"');
  await run('echo line >> file && git add file && git commit -m "Second commit"');
  t.shouldReject(
    getChangelog({
      changelogCommand: 'git log --invalid',
      tagName: '%s',
      latestVersion: '1.0.0'
    }),
    /Could not create changelog/
  );

  const changelog = await getChangelog({
    changelogCommand: config.options.changelogCommand,
    tagName: '%s',
    latestVersion: '1.0.0'
  });
  const pattern = /^\* Second commit \(\w{7}\)\n\* First commit \(\w{7}\)$/;
  t.ok(pattern.test(changelog));

  await run('git tag 1.0.0');
  await run('echo line C >> file && git add file && git commit -m "Third commit"');
  await run('echo line D >> file && git add file && git commit -m "Fourth commit"');

  const changelogSinceTag = await getChangelog({
    changelogCommand: config.options.changelogCommand,
    tagName: '%s',
    latestVersion: '1.0.0'
  });
  const pattern1 = /^\* Fourth commit \(\w{7}\)\n\* Third commit \(\w{7}\)$/;
  t.ok(pattern1.test(changelogSinceTag));

  shell.popd();
  shell.rm('-rf', tmp);
  t.end();
});
