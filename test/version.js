import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import Version from '../lib/plugin/version/Version.js';
import { factory, runTasks } from './util/index.js';

describe('version', () => {
  test('should validate custom versions', async () => {
    const v = await factory(Version);
    const { validate } = v.prompt.prompts.version.version;
    assert.equal(validate('1.0.0'), true);
    assert.equal(validate('1.0'), 'The version must follow the semver standard.');
  });

  test('should detect whether the latest version is a prerelease', async () => {
    const v = await factory(Version);
    v.incrementVersion({ latestVersion: '1.0.0-beta.0', increment: '1.0.0' });
    assert.equal(v.getContext('latestIsPreRelease'), true);
    v.incrementVersion({ latestVersion: '1.0.0', increment: '1.0.0' });
    assert.equal(v.getContext('latestIsPreRelease'), false);
  });

  test('should render increment choices', async () => {
    const v = await factory(Version);
    const choices = v.prompt.prompts.version.incrementList.choices({ latestVersion: '1.2.3', version: {} });
    assert.deepEqual(choices.slice(0, -2), [
      { name: 'patch (1.2.4)', value: 'patch' },
      { name: 'minor (1.3.0)', value: 'minor' },
      { name: 'major (2.0.0)', value: 'major' },
      { name: 'prepatch (1.2.4-0)', value: 'prepatch' },
      { name: 'preminor (1.3.0-0)', value: 'preminor' },
      { name: 'premajor (2.0.0-0)', value: 'premajor' }
    ]);
  });

  test('should render prerelease choices with the configured identifier and base', async () => {
    const v = await factory(Version);
    const choices = v.prompt.prompts.version.incrementList.choices({
      latestVersion: '1.2.3',
      version: { isPreRelease: true, preReleaseId: 'beta', preReleaseBase: '1' }
    });
    assert.deepEqual(choices.slice(0, -2), [
      { name: 'prepatch (1.2.4-beta.1)', value: 'prepatch' },
      { name: 'preminor (1.3.0-beta.1)', value: 'preminor' },
      { name: 'premajor (2.0.0-beta.1)', value: 'premajor' }
    ]);
  });

  test('should render choices for continuing or finalizing a prerelease', async () => {
    const v = await factory(Version);
    const choices = v.prompt.prompts.version.incrementList.choices({
      latestVersion: '2.0.0-beta.1',
      version: { latestIsPreRelease: true, preReleaseId: 'rc', preReleaseBase: '1' }
    });
    assert.deepEqual(choices.slice(0, -2), [
      { name: 'prerelease (2.0.0-rc.1)', value: 'prerelease' },
      { name: 'patch (2.0.0)', value: 'patch' },
      { name: 'minor (2.0.0)', value: 'minor' },
      { name: 'major (2.0.0)', value: 'major' }
    ]);
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
    const v = await factory(Version, { options: { ci: false } });
    assert.equal(v.incrementVersion({ increment: 0 }), '0.0.0');
    assert.equal(v.incrementVersion({ increment: 1 }), '1.0.0');
    assert.equal(v.incrementVersion({ increment: '1.2' }), '1.2.0');
    assert.equal(v.incrementVersion({ increment: '1' }), '1.0.0');
    assert.equal(v.incrementVersion({ increment: 'v1.2.0.0' }), '1.2.0');
  });

  test('should log the coerced version', async () => {
    const v = await factory(Version);
    v.incrementVersion({ latestVersion: '1.0.0', increment: '1.2' });
    assert.deepEqual(v.log.warn.mock.calls[0].arguments, ['Coerced invalid semver version "1.2" into "1.2.0".']);
  });

  test('should default to a prerelease patch in CI mode', async () => {
    const v = await factory(Version);
    assert.equal(
      v.getIncrementedVersionCI({
        latestVersion: '1.2.3',
        increment: null,
        isPreRelease: true,
        preReleaseId: 'beta',
        preReleaseBase: '1'
      }),
      '1.2.4-beta.1'
    );
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

  test('should use the prerelease base without an identifier', async () => {
    const v = await factory(Version);
    assert.equal(v.incrementVersion({ latestVersion: '1.2.3', increment: 'prepatch', preReleaseBase: '1' }), '1.2.4-1');
    const choices = v.prompt.prompts.version.incrementList.choices({
      latestVersion: '1.2.3',
      version: { isPreRelease: true, preReleaseBase: '1' }
    });
    assert.deepEqual(choices.slice(0, -2), [
      { name: 'prepatch (1.2.4-1)', value: 'prepatch' },
      { name: 'preminor (1.3.0-1)', value: 'preminor' },
      { name: 'premajor (2.0.0-1)', value: 'premajor' }
    ]);
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
