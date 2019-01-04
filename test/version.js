const test = require('tape');
const sh = require('shelljs');
const mockStdIo = require('mock-stdio');
const uuid = require('uuid/v4');
const Version = require('../lib/version');
const { gitAdd } = require('./util/index');

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

test('setLatestVersion', t => {
  const v = new Version();
  v.setLatestVersion({ gitTag: '1.2.0' });
  t.equal(v.latestVersion, '1.2.0');
  v.setLatestVersion({ gitTag: 'v1.2.1', pkgVersion: '1.2.2' });
  t.equal(v.latestVersion, '1.2.1');
  v.setLatestVersion({ use: 'pkg.version', pkgVersion: '1.2.3' });
  t.equal(v.latestVersion, '1.2.3');
  t.end();
});

test('setLatestVersion (not root dir)', t => {
  const v = new Version();
  v.setLatestVersion({ gitTag: '1.2.3', pkgVersion: '1.2.4', isRootDir: false });
  t.equal(v.latestVersion, '1.2.4');
  t.end();
});

test('setLatestVersion (invalid tag/fallback)', t => {
  const v = new Version();
  mockStdIo.start();
  v.setLatestVersion({ gitTag: 'a.b.c', pkgVersion: '0.0.1' });
  const { stdout } = mockStdIo.end();
  t.ok(/Latest Git tag \(a\.b\.c\) is not a valid semver version/.test(stdout));
  t.equal(v.latestVersion, '0.0.1');
  t.end();
});

test('setLatestVersion (invalid package version)', t => {
  const v = new Version();
  mockStdIo.start();
  v.setLatestVersion({ use: 'pkg.version', pkgVersion: '1.2' });
  const { stdout } = mockStdIo.end();
  t.ok(/The version in package.json \(1\.2\) is not a valid semver version/.test(stdout));
  t.end();
});

test('setLatestVersion (invalid git tag and package version)', t => {
  const v = new Version();
  mockStdIo.start();
  v.setLatestVersion({ gitTag: '1', pkgVersion: '2' });
  const { stdout } = mockStdIo.end();
  t.ok(
    /Could not find valid latest Git tag or version in package.json. Using "0\.0\.0" as latest version/.test(stdout)
  );
  t.end();
});

test('bump', async t => {
  const v = new Version();
  v.setLatestVersion({ gitTag: '2.2.0' });
  await v.bump({ increment: 'patch' });
  t.equal(v.latestVersion, '2.2.0');
  t.equal(v.version, '2.2.1');
  t.end();
});

test('bump (to provided version)', async t => {
  const v = new Version();
  v.setLatestVersion({ gitTag: '1.0.0' });
  await v.bump({ increment: '1.2.3' });
  t.equal(v.version, '1.2.3');
  t.end();
});

test('bump (to lower version)', async t => {
  const v = new Version();
  v.setLatestVersion({ gitTag: '2.2.0' });
  await v.bump({ increment: '0.8.0' });
  t.equal(v.version, undefined);
  t.end();
});

test('bump (null)', async t => {
  const v = new Version();
  v.setLatestVersion({ gitTag: '2.2.0' });
  await v.bump({ increment: null });
  t.equal(v.version, undefined);
  t.end();
});

test('bump (patch pre-release)', async t => {
  const v = new Version({ preReleaseId: 'alpha' });
  v.setLatestVersion({ gitTag: '0.2.0' });
  await v.bump({ increment: 'prepatch', preRelease: true });
  t.equal(v.version, '0.2.1-alpha.0');
  t.end();
});

test('bump (patch pre-release normalized)', async t => {
  const v = new Version({ preReleaseId: 'alpha' });
  v.setLatestVersion({ gitTag: '0.2.0' });
  await v.bump({ increment: 'patch', preRelease: true });
  t.equal(v.version, '0.2.1-alpha.0');
  t.end();
});

test('bump (prerelease)', async t => {
  const v = new Version({ preReleaseId: 'alpha' });
  v.setLatestVersion({ gitTag: '0.2.1' });
  await v.bump({ increment: 'prerelease', preRelease: true });
  t.equal(v.version, '0.2.2-alpha.0');
  t.end();
});

test('bump (prepatch continuation)', async t => {
  const v = new Version();
  v.setLatestVersion({ gitTag: '0.2.1-alpha.0' });
  await v.bump({ increment: 'prerelease' });
  t.equal(v.version, '0.2.1-alpha.1');
  t.end();
});

test('bump (preReleaseId continuation)', async t => {
  const v = new Version({ preReleaseId: 'alpha' });
  v.setLatestVersion({ gitTag: '0.2.1-alpha.0' });
  await v.bump({ increment: 'prerelease' });
  t.equal(v.version, '0.2.1-alpha.1');
  t.end();
});

test('bump (prepatch/preReleaseId continuation)', async t => {
  const v = new Version({ preReleaseId: 'alpha' });
  v.setLatestVersion({ gitTag: '0.2.1-alpha.0' });
  await v.bump({ increment: 'prerelease', preRelease: true });
  t.equal(v.version, '0.2.1-alpha.1');
  t.end();
});

test('bump (preReleaseId w/o preRelease)', async t => {
  const v = new Version({ preReleaseId: 'alpha' });
  v.setLatestVersion({ gitTag: '0.2.1-alpha.0' });
  await v.bump({ increment: 'patch' });
  t.equal(v.version, '0.2.1');
  t.end();
});

test('bump (non-numeric prepatch continuation)', async t => {
  const v = new Version();
  v.setLatestVersion({ gitTag: '0.2.1-alpha' });
  await v.bump({ increment: 'prerelease' });
  t.equal(v.version, '0.2.1-alpha.0');
  t.end();
});

test('bump (patch release after pre-release)', async t => {
  const v = new Version();
  v.setLatestVersion({ gitTag: '0.2.1-alpha.1' });
  await v.bump({ increment: 'patch' });
  t.equal(v.version, '0.2.1');
  t.end();
});

test('bump (recommended conventional)', async t => {
  const tmp = `tmp/${uuid()}`;
  sh.mkdir(tmp);
  sh.pushd('-q', tmp);
  sh.exec('git init');
  gitAdd('line', 'file', 'fix(thing): repair that thing');
  sh.exec(`git tag 1.0.0`);
  gitAdd('line', 'file', 'feat(foo): extend the foo');
  gitAdd('line', 'file', 'feat(bar): more bar');

  const v = new Version();
  v.setLatestVersion({ gitTag: '1.0.0' });
  await v.bump({ increment: 'conventional:angular' });
  t.equal(v.version, '1.1.0');

  sh.popd('-q');
  t.end();
});

const recommendations = {
  isRecommendation: () => true,
  getRecommendedType: () => Promise.resolve('minor')
};

test('bump (recommended conventional w/ pre-release)', async t => {
  const v = new Version({ preReleaseId: 'canary', recommendations });
  v.setLatestVersion({ gitTag: '1.0.0' });
  await v.bump({ increment: 'conventional:angular', preRelease: true });
  t.equal(v.version, '1.1.0-canary.0');
  t.end();
});

test('bump (recommended conventional w/o preRelease)', async t => {
  const v = new Version({ preReleaseId: 'canary', recommendations });
  v.setLatestVersion({ gitTag: '1.0.0' });
  await v.bump({ increment: 'conventional:angular' });
  t.equal(v.version, '1.1.0');
  t.end();
});

test('bump (recommended conventional w/ pre-release continuation)', async t => {
  const v = new Version({ preReleaseId: 'canary', recommendations });
  v.setLatestVersion({ gitTag: '1.0.0-canary.1' });
  await v.bump({ increment: 'conventional:angular', preRelease: true });
  t.equal(v.version, '1.0.0-canary.2');
  t.end();
});

test('parse (coerce)', async t => {
  const v = new Version();
  mockStdIo.start();
  v.bump({ increment: '2' });
  const { stdout } = mockStdIo.end();
  t.ok(/Coerced invalid semver version "2" into "2.0.0"/.test(stdout));
  t.end();
});
