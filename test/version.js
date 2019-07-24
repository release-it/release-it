const test = require('ava');
const sinon = require('sinon');
const Version = require('../lib/plugin/version/Version');
const { factory, runTasks } = require('./util');

test('isValidVersion', t => {
  const v = factory(Version);
  t.is(v.isValid('1.0.0'), true);
  t.is(v.isValid(1.0), false);
});

test('isPreRelease', t => {
  const v = factory(Version);
  t.is(v.isPreRelease('1.0.0-beta.0'), true);
  t.is(v.isPreRelease('1.0.0'), false);
});

test('should increment latest version', t => {
  const v = factory(Version);
  const latestVersion = '1.0.0';
  t.is(v.incrementVersion({ latestVersion, increment: false }), '1.0.0');
  t.is(v.incrementVersion({ latestVersion, increment: null }), undefined);
  t.is(v.incrementVersion({ latestVersion, increment: 'foo' }), undefined);
  t.is(v.incrementVersion({ latestVersion, increment: 'patsj' }), undefined);
  t.is(v.incrementVersion({ latestVersion, increment: 'a.b.c' }), undefined);
  t.is(v.incrementVersion({ latestVersion, increment: '0.9.0' }), undefined);
  t.is(v.incrementVersion({ latestVersion, increment: '1.1.0' }), '1.1.0');
  t.is(v.incrementVersion({ latestVersion, increment: 'major' }), '2.0.0');
  t.is(v.incrementVersion({ latestVersion, increment: '2.0.0-beta.1' }), '2.0.0-beta.1');
});

test('should increment latest version (coerce)', t => {
  const v = factory(Version);
  t.is(v.incrementVersion({ increment: '1.2' }), '1.2.0');
  t.is(v.incrementVersion({ increment: '1' }), '1.0.0');
  t.is(v.incrementVersion({ increment: 'v1.2.0.0' }), '1.2.0');
});

test('should increment version (pre-release continuation)', t => {
  const v = factory(Version);
  t.is(v.incrementVersion({ latestVersion: '1.2.3-alpha.0', increment: 'prepatch' }), '1.2.3-alpha.1');
});

test('should increment version (prepatch)', t => {
  const v = factory(Version);
  t.is(v.incrementVersion({ latestVersion: '1.2.3', increment: 'prepatch', preReleaseId: 'alpha' }), '1.2.4-alpha.0');
});

test('should increment version (normalized)', t => {
  const v = factory(Version);
  t.is(
    v.incrementVersion({ latestVersion: '1.2.3', increment: 'patch', preReleaseId: 'alpha', isPreRelease: true }),
    '1.2.4-alpha.0'
  );
});

test('should increment version (prerelease)', t => {
  const v = factory(Version);
  t.is(v.incrementVersion({ latestVersion: '1.2.3', increment: 'prerelease', preReleaseId: 'alpha' }), '1.2.4-alpha.0');
});

test('should increment version (prerelease cont.)', t => {
  const v = factory(Version);
  t.is(v.incrementVersion({ latestVersion: '1.2.3-alpha.0', increment: 'prerelease' }), '1.2.3-alpha.1');
});

test('should increment version (preReleaseId continuation)', t => {
  const v = factory(Version);
  t.is(
    v.incrementVersion({ latestVersion: '1.2.3-alpha.0', increment: 'prerelease', preReleaseId: 'alpha' }),
    '1.2.3-alpha.1'
  );
});

test('should increment version (prepatch/preReleaseId continuation)', t => {
  const v = factory(Version);
  const options = { latestVersion: '1.2.3-beta.0', increment: 'prerelease', preReleaseId: 'beta', isPreRelease: true };
  t.is(v.incrementVersion(options), '1.2.3-beta.1');
});

test('should increment version (preReleaseId w/o preRelease)', t => {
  const v = factory(Version);
  t.is(v.incrementVersion({ latestVersion: '1.2.3-alpha.0', increment: 'patch', preReleaseId: 'alpha' }), '1.2.3');
});

test('should increment version (non-numeric prepatch continuation)', t => {
  const v = factory(Version);
  t.is(v.incrementVersion({ latestVersion: '1.2.3-alpha', increment: 'prerelease' }), '1.2.3-alpha.0');
});

test('should increment version (patch release after pre-release)', t => {
  const v = factory(Version);
  t.is(v.incrementVersion({ latestVersion: '1.2.3-alpha.1', increment: 'patch' }), '1.2.3');
});

test('should run tasks without errors', async t => {
  const options = { version: { increment: 'minor' } };
  const v = factory(Version, { options });
  const getIncrementedVersionCI = sinon.spy(v, 'getIncrementedVersionCI');
  const incrementVersion = sinon.spy(v, 'incrementVersion');
  await runTasks(v);
  t.is(getIncrementedVersionCI.callCount, 1);
  t.deepEqual(getIncrementedVersionCI.firstCall.args[0], { latestVersion: '0.0.0', increment: 'minor' });
  t.is(await incrementVersion.firstCall.returnValue, '0.1.0');
  t.is(incrementVersion.callCount, 1);
  t.deepEqual(incrementVersion.firstCall.args[0], { latestVersion: '0.0.0', increment: 'minor' });
  t.is(incrementVersion.firstCall.returnValue, '0.1.0');
  const { latestVersion, version, isPreRelease, preReleaseId } = v.config.getContext();
  t.is(latestVersion, '0.0.0');
  t.is(version, '0.1.0');
  t.is(isPreRelease, false);
  t.is(preReleaseId, null);
});
