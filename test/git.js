import test from 'tape';
import proxyquire from 'proxyquire';
import * as logMock from './mock/log';
import Config from '../lib/config';
import { readJSON } from './util/index';
import semver from 'semver';

const config = new Config();

const mocks = {
  './log': logMock,
  './config': {
    config
  }
};

const { run, pushd, popd, mkCleanDir, copy } = proxyquire('../lib/shell', mocks);
const {
  isGitRepo,
  tagExists,
  getRemoteUrl,
  isWorkingDirClean,
  clone,
  stage,
  commit,
  tag,
  getLatestTag,
  push,
  getChangelog
} = proxyquire('../lib/git', mocks);

test('isGitRepo + tagExists + isWorkingDirClean + hasChanges', async t => {
  const dir = 'test/resources';
  const tmp = `${dir}/tmp`;
  await mkCleanDir(tmp);
  await pushd(tmp);
  const actual_notIsGitRepo = await isGitRepo();
  t.notOk(actual_notIsGitRepo);
  await run('git init');
  const actual_isGitRepo = await isGitRepo();
  t.ok(actual_isGitRepo);
  const actual_notTagExists = await tagExists('1.0.0');
  t.notOk(actual_notTagExists);
  await run('touch file1');
  const actual_notIsWorkingDirClean = await isWorkingDirClean();
  t.notOk(actual_notIsWorkingDirClean);
  await run('git add file1');
  await run('git commit -am "Add file1"');
  await run('git tag 1.0.0');
  const actual_tagExists = await tagExists('1.0.0');
  t.ok(actual_tagExists);
  const actual_isWorkingDirClean = await isWorkingDirClean();
  t.ok(actual_isWorkingDirClean);
  await popd();
  await run(`rm -rf ${tmp}`);
  t.end();
});

test('getRemoteUrl', async t => {
  const remoteUrl = await getRemoteUrl();
  t.equal(remoteUrl, 'https://github.com/webpro/release-it.git');
  t.end();
});

test('clone + stage + commit + tag + push', async t => {
  const dir = 'test/resources';
  const tmp = `${dir}/tmp`;
  const tmpOrigin = `${dir}/bare.git`;
  await run(`git init --bare ${tmpOrigin}`);
  await clone(tmpOrigin, tmp);
  await copy('package.json', {}, tmp);
  await pushd(tmp);
  await stage('package.json');
  await commit('.', 'Add package.json');
  const pkgBefore = await readJSON('package.json');
  const versionBefore = pkgBefore.version;
  await run(`git tag ${versionBefore}`);
  const actual_latestTagBefore = await getLatestTag();
  t.ok(await isGitRepo());
  t.equal(versionBefore, actual_latestTagBefore);
  await run('!echo line >> file1');
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
  const status = await run('!git status -uno');
  t.ok(status.includes('nothing to commit'));
  await popd();
  await run(`rm -rf ${tmpOrigin}`);
  await run(`rm -rf ${tmp}`);
  t.end();
});

test('getChangelog', async t => {
  const dir = 'test/resources';
  const tmp = `${dir}/tmp`;
  await mkCleanDir(tmp);
  await pushd(tmp);
  await run('git init');
  await run('!echo line >> file && git add file && git commit -m "First commit"');
  await run('!echo line >> file && git add file && git commit -m "Second commit"');
  t.shouldReject(
    getChangelog(
      {
        changelogCommand: 'git log --invalid',
        tagName: '%s',
        latestVersion: '1.0.0'
      },
      /Could not create changelog/
    )
  );

  const changelog = await getChangelog({
    changelogCommand: config.options.changelogCommand,
    tagName: '%s',
    latestVersion: '1.0.0'
  });
  const pattern = /^\* Second commit \(\w{7}\)\n\* First commit \(\w{7}\)$/;
  t.ok(pattern.test(changelog));

  await run('git tag 1.0.0');
  await run('!echo line C >> file && git add file && git commit -m "Third commit"');
  await run('!echo line D >> file && git add file && git commit -m "Fourth commit"');

  const changelogSinceTag = await getChangelog({
    changelogCommand: config.options.changelogCommand,
    tagName: '%s',
    latestVersion: '1.0.0'
  });
  const pattern1 = /^\* Fourth commit \(\w{7}\)\n\* Third commit \(\w{7}\)$/;
  t.ok(pattern1.test(changelogSinceTag));

  await popd();
  await run(`rm -rf ${tmp}`);
  t.end();
});
