const test = require('tape');
const sh = require('shelljs');
const mockStdIo = require('mock-stdio');
const Version = require('../lib/version');

test('isValidVersion', t => {
  const v = new Version();
  t.equal(v.isValid('1.0.0'), true);
  t.equal(v.isValid(1.0), false);
  t.end();
});

test('isPreRelease', t => {
  const v = new Version();
  t.equal(v.isPreRelease('1.0.0-beta.0'), true);
  t.equal(v.isPreRelease('1.0.0'), false);
  t.end();
});

test('bump', async t => {
  const v = new Version({ latestVersion: '2.2.0' });
  await v.bump({ increment: 'patch' });
  t.equal(v.version, '2.2.1');
  t.end();
});

test('bump (to provided version)', async t => {
  const v = new Version({ latestVersion: '1.0.0' });
  await v.bump({ increment: '1.2.3' });
  t.equal(v.version, '1.2.3');
  t.end();
});

test('bump (to lower version)', async t => {
  const v = new Version({ latestVersion: '2.2.0' });
  await v.bump({ increment: '0.8.0' });
  t.equal(v.version, undefined);
  t.end();
});

test('bump (null)', async t => {
  const v = new Version({ latestVersion: '2.2.0' });
  await v.bump({ increment: null });
  t.equal(v.version, undefined);
  t.end();
});

test('bump (patch pre-release)', async t => {
  const v = new Version({ latestVersion: '0.2.0', preReleaseId: 'alpha' });
  await v.bump({ increment: 'prepatch', preRelease: true });
  t.equal(v.version, '0.2.1-alpha.0');
  t.end();
});

test('bump (patch pre-release normalized)', async t => {
  const v = new Version({ latestVersion: '0.2.0', preReleaseId: 'alpha' });
  await v.bump({ increment: 'patch', preRelease: true });
  t.equal(v.version, '0.2.1-alpha.0');
  t.end();
});

test('bump (prerelease)', async t => {
  const v = new Version({ latestVersion: '0.2.1', preReleaseId: 'alpha' });
  await v.bump({ increment: 'prerelease', preRelease: true });
  t.equal(v.version, '0.2.2-alpha.0');
  t.end();
});

test('bump (prepatch continuation)', async t => {
  const v = new Version({ latestVersion: '0.2.1-alpha.0' });
  await v.bump({ increment: 'prerelease' });
  t.equal(v.version, '0.2.1-alpha.1');
  t.end();
});

test('bump (preReleaseId continuation)', async t => {
  const v = new Version({ latestVersion: '0.2.1-alpha.0', preReleaseId: 'alpha' });
  await v.bump({ increment: 'prerelease' });
  t.equal(v.version, '0.2.1-alpha.1');
  t.end();
});

test('bump (prepatch/preReleaseId continuation)', async t => {
  const v = new Version({ latestVersion: '0.2.1-alpha.0', preReleaseId: 'alpha' });
  await v.bump({ increment: 'prerelease', preRelease: true });
  t.equal(v.version, '0.2.1-alpha.1');
  t.end();
});

test('bump (preReleaseId w/o preRelease)', async t => {
  const v = new Version({ latestVersion: '0.2.1-alpha.0', preReleaseId: 'alpha' });
  await v.bump({ increment: 'patch' });
  t.equal(v.version, '0.2.1');
  t.end();
});

test('bump (non-numeric prepatch continuation)', async t => {
  const v = new Version({ latestVersion: '0.2.1-alpha' });
  await v.bump({ increment: 'prerelease' });
  t.equal(v.version, '0.2.1-alpha.0');
  t.end();
});

test('bump (patch release after pre-release)', async t => {
  const v = new Version({ latestVersion: '0.2.1-alpha.1' });
  await v.bump({ increment: 'patch' });
  t.equal(v.version, '0.2.1');
  t.end();
});

test('bump (recommended conventional)', async t => {
  const tmp = 'test/resources/tmp';
  sh.mkdir(tmp);
  sh.pushd('-q', tmp);
  sh.exec('git init');
  sh.exec('echo line >> file && git add file && git commit -m "fix(thing): repair that thing"');
  sh.exec(`git tag 1.0.0`);
  sh.exec('echo line >> file && git add file && git commit -m "feat(foo): extend the foo"');
  sh.exec('echo line >> file && git add file && git commit -m "feat(bar): more bar"');

  const v = new Version({ latestVersion: '1.0.0' });
  await v.bump({ increment: 'conventional:angular' });
  t.equal(v.version, '1.1.0');

  sh.popd('-q');
  sh.rm('-rf', tmp);
  t.end();
});

const recommendations = {
  isRecommendation: () => true,
  getRecommendedType: () => Promise.resolve('minor')
};

test('bump (recommended conventional w/ pre-release)', async t => {
  const v = new Version({ latestVersion: '1.0.0', preReleaseId: 'canary', recommendations });
  await v.bump({ increment: 'conventional:angular', preRelease: true });
  t.equal(v.version, '1.1.0-canary.0');
  t.end();
});

test('bump (recommended conventional w/o preRelease)', async t => {
  const v = new Version({ latestVersion: '1.0.0', preReleaseId: 'canary', recommendations });
  await v.bump({ increment: 'conventional:angular' });
  t.equal(v.version, '1.1.0');
  t.end();
});

test('bump (recommended conventional w/ pre-release continuation)', async t => {
  const v = new Version({ latestVersion: '1.0.0-canary.1', preReleaseId: 'canary', recommendations });
  await v.bump({ increment: 'conventional:angular', preRelease: true });
  t.equal(v.version, '1.0.0-canary.2');
  t.end();
});

test('bump (invalid tag)', async t => {
  const v = new Version();
  mockStdIo.start();
  v.showWarnings({ latestGitTag: 'a.b.c', npmVersion: '0.0.1', useTag: true });
  const { stdout } = mockStdIo.end();
  t.ok(/Latest Git tag \(a\.b\.c\) is not a valid semver version/.test(stdout));
  t.end();
});

test('parse (invalid npm version)', async t => {
  const v = new Version();
  mockStdIo.start();
  v.showWarnings({ latestGitTag: '2.2.0', npmVersion: '1.2' });
  const { stdout } = mockStdIo.end();
  t.ok(/The npm version \(1\.2\) is not a valid semver version/.test(stdout));
  t.end();
});

test('bump (not matching)', async t => {
  const v = new Version();
  mockStdIo.start();
  v.showWarnings({ latestGitTag: '1.0.0', npmVersion: '1.0.1', useTag: true });
  const { stdout } = mockStdIo.end();
  t.ok(/Latest Git tag \(1\.0\.0\) doesn't match package.json#version \(1\.0\.1\)/.test(stdout));
  t.end();
});

test('parse (coerce)', async t => {
  const v = new Version({ latestVersion: '1.1.0' });
  mockStdIo.start();
  v.bump({ increment: '2' });
  const { stdout } = mockStdIo.end();
  t.ok(/Coerced invalid semver version "2" into "2.0.0"/.test(stdout));
  t.end();
});
