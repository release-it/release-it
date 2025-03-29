import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import Version from '../lib/plugin/version/Version.js';
import { factory, runTasks } from './util/index.js';

describe('version', () => {
  test('isValidVersion', async () => {
    const v = await factory(Version);
    assert.equal(v.isValid('1.0.0'), true);
    assert.equal(v.isValid(1.0), false);
  });

  test('isPreRelease', async () => {
    const v = await factory(Version);
    assert.equal(v.isPreRelease('1.0.0-beta.0'), true);
    assert.equal(v.isPreRelease('1.0.0'), false);
  });

  test('should return the same version in both interactive and ci mode', async () => {
    const v = await factory(Version);
    const options = { latestVersion: '2.0.0-beta.1', increment: null, preReleaseId: 'rc', isPreRelease: true };
    const resultInteractiveMode = await v.getIncrementedVersion(options);
    assert.equal(resultInteractiveMode, '2.0.0-rc.0');
    const resultCiMode = v.getIncrementedVersionCI(options);
    assert.equal(resultInteractiveMode, resultCiMode);
  });

  test('should increment latest version', async () => {
    const v = await factory(Version);
    const latestVersion = '1.0.0';
    assert.equal(v.incrementVersion({ latestVersion, increment: false }), '1.0.0');
    assert.equal(v.incrementVersion({ latestVersion, increment: 'foo' }), undefined);
    assert.equal(v.incrementVersion({ latestVersion, increment: 'patsj' }), undefined);
    assert.equal(v.incrementVersion({ latestVersion, increment: 'a.b.c' }), undefined);
    assert.equal(v.incrementVersion({ latestVersion, increment: '0.9.0' }), undefined);
    assert.equal(v.incrementVersion({ latestVersion, increment: '1.1.0' }), '1.1.0');
    assert.equal(v.incrementVersion({ latestVersion, increment: 'major' }), '2.0.0');
    assert.equal(v.incrementVersion({ latestVersion, increment: '2.0.0-beta.1' }), '2.0.0-beta.1');
  });

  test('should not increment latest version in interactive mode', async () => {
    const v = await factory(Version, { options: { ci: false } });
    const latestVersion = '1.0.0';
    assert.equal(v.incrementVersion({ latestVersion, increment: null }), undefined);
    assert.equal(v.incrementVersion({ latestVersion, increment: false }), '1.0.0');
  });

  test('should always set increment version in CI mode', async () => {
    const v = await factory(Version, { options: { ci: true } });
    const latestVersion = '1.0.0';
    assert.equal(v.getIncrementedVersionCI({ latestVersion, increment: false }), '1.0.0');
    assert.equal(v.getIncrementedVersionCI({ latestVersion, increment: null }), '1.0.1');
    assert.equal(v.getIncrementedVersionCI({ latestVersion, increment: '1.1.0' }), '1.1.0');
    assert.equal(v.getIncrementedVersionCI({ latestVersion, increment: 'major' }), '2.0.0');
  });

  test('should increment latest version (coerce)', async () => {
    const v = await factory(Version);
    assert.equal(v.incrementVersion({ increment: '1.2' }), '1.2.0');
    assert.equal(v.incrementVersion({ increment: '1' }), '1.0.0');
    assert.equal(v.incrementVersion({ increment: 'v1.2.0.0' }), '1.2.0');
  });

  test('should increment version (pre-release continuation)', async () => {
    const v = await factory(Version);
    assert.equal(v.incrementVersion({ latestVersion: '1.2.3-alpha.0', increment: 'prepatch' }), '1.2.4-0');
  });

  test('should increment version (prepatch)', async () => {
    const v = await factory(Version);
    assert.equal(
      v.incrementVersion({ latestVersion: '1.2.3', increment: 'prepatch', preReleaseId: 'alpha' }),
      '1.2.4-alpha.0'
    );
  });

  test('should increment version (normalized)', async () => {
    const v = await factory(Version);
    assert.equal(
      v.incrementVersion({ latestVersion: '1.2.3', increment: 'patch', preReleaseId: 'alpha', isPreRelease: true }),
      '1.2.4-alpha.0'
    );
  });

  test('should increment version (prepatch on prerelease version)', async () => {
    const v = await factory(Version);
    assert.equal(
      v.incrementVersion({ latestVersion: '1.2.3-alpha.5', increment: 'prepatch', preReleaseId: 'next' }),
      '1.2.4-next.0'
    );
  });

  test('should increment version (normalized on prerelease version)', async () => {
    const v = await factory(Version);
    assert.equal(
      v.incrementVersion({
        latestVersion: '1.2.3-alpha.5',
        increment: 'patch',
        preReleaseId: 'next',
        isPreRelease: true
      }),
      '1.2.4-next.0'
    );
  });

  test('should increment version (prerelease)', async () => {
    const v = await factory(Version);
    assert.equal(
      v.incrementVersion({ latestVersion: '1.2.3', increment: 'prerelease', preReleaseId: 'alpha' }),
      '1.2.4-alpha.0'
    );
  });

  test('should increment version (prerelease cont.)', async () => {
    const v = await factory(Version);
    assert.equal(v.incrementVersion({ latestVersion: '1.2.3-alpha.0', increment: 'prerelease' }), '1.2.3-alpha.1');
  });

  test('should increment version (preReleaseId continuation)', async () => {
    const v = await factory(Version);
    assert.equal(
      v.incrementVersion({ latestVersion: '1.2.3-alpha.0', increment: 'prerelease', preReleaseId: 'alpha' }),
      '1.2.3-alpha.1'
    );
  });

  test('should increment version (prepatch/preReleaseId continuation)', async () => {
    const v = await factory(Version);
    const options = {
      latestVersion: '1.2.3-beta.0',
      increment: 'prerelease',
      preReleaseId: 'beta',
      isPreRelease: true
    };
    assert.equal(v.incrementVersion(options), '1.2.3-beta.1');
  });

  test('should increment version (preReleaseId w/o preRelease)', async () => {
    const v = await factory(Version);
    assert.equal(
      v.incrementVersion({ latestVersion: '1.2.3-alpha.0', increment: 'patch', preReleaseId: 'alpha' }),
      '1.2.3'
    );
  });

  test('should increment version (non-numeric prepatch continuation)', async () => {
    const v = await factory(Version);
    assert.equal(v.incrementVersion({ latestVersion: '1.2.3-alpha', increment: 'prerelease' }), '1.2.3-alpha.0');
  });

  test('should increment version (patch release after pre-release)', async () => {
    const v = await factory(Version);
    assert.equal(v.incrementVersion({ latestVersion: '1.2.3-alpha.1', increment: 'patch' }), '1.2.3');
  });

  test('should increment version and start at base 1', async () => {
    const v = await factory(Version);
    assert.equal(
      v.incrementVersion({
        latestVersion: '1.3.0',
        increment: 'major',
        isPreRelease: true,
        preReleaseId: 'beta',
        preReleaseBase: '1'
      }),
      '2.0.0-beta.1'
    );
  });

  test('should increment prerelease version and ignore prelease base 1', async () => {
    const v = await factory(Version);
    assert.equal(
      v.incrementVersion({
        latestVersion: '1.2.3-alpha.5',
        increment: 'prerelease',
        preReleaseId: 'alpha',
        isPreRelease: true,
        preReleaseBase: '1'
      }),
      '1.2.3-alpha.6'
    );
  });

  test('should run tasks without errors', async t => {
    const options = { version: { increment: 'minor' } };
    const v = await factory(Version, { options });
    const getIncrement = t.mock.method(v, 'getIncrement');
    const getIncrementedVersionCI = t.mock.method(v, 'getIncrementedVersionCI');
    const incrementVersion = t.mock.method(v, 'incrementVersion');

    await runTasks(v);

    assert.equal(getIncrement.mock.callCount(), 1);
    assert.deepEqual(getIncrement.mock.calls[0].arguments[0], { increment: 'minor' });
    assert.equal(getIncrementedVersionCI.mock.callCount(), 1);
    assert.deepEqual(getIncrementedVersionCI.mock.calls[0].arguments[0], {
      latestVersion: '1.0.0',
      increment: 'minor',
      isPreRelease: false,
      preReleaseId: null
    });
    assert.equal(await incrementVersion.mock.calls[0].result, '1.1.0');
    assert.equal(incrementVersion.mock.callCount(), 1);
    assert.deepEqual(incrementVersion.mock.calls[0].arguments[0], {
      latestVersion: '1.0.0',
      increment: 'minor',
      isPreRelease: false,
      preReleaseId: null
    });
    assert.equal(incrementVersion.mock.calls[0].result, '1.1.0');
    const { latestVersion, version, isPreRelease, preReleaseId } = v.config.getContext();
    assert.equal(latestVersion, '1.0.0');
    assert.equal(version, '1.1.0');
    assert.equal(isPreRelease, false);
    assert.equal(preReleaseId, null);
  });
});
