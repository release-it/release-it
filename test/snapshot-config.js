import test from 'node:test';
import assert from 'node:assert/strict';
import Config from '../lib/config.js';
import { readJSON } from '../lib/util.js';

test('snapshot configuration leaves defaults and other instances unchanged', async () => {
  const defaults = readJSON(new URL('../config/release-it.json', import.meta.url));
  const before = new Config({ config: false });
  await before.init();
  const original = structuredClone(before.options);
  const snapshot = new Config({ config: false, snapshot: 'trial' });
  await snapshot.init();
  const after = new Config({ config: false });
  await after.init();

  assert.equal(snapshot.options.git.tagMatch, '0.0.0-trial.[0-9]*');
  assert.equal(snapshot.options.git.getLatestTagFromAllRefs, true);
  assert.equal(snapshot.options.git.requireBranch, '!main');
  assert.equal(snapshot.options.git.requireUpstream, false);
  assert.equal(snapshot.options.npm.ignoreVersion, true);
  assert.deepEqual(before.options, original);
  assert.deepEqual(after.options, original);
  assert.deepEqual(snapshot.defaultConfig, defaults);
});

test('separate named snapshots keep their own tag matching options', async () => {
  const first = new Config({ config: false, snapshot: 'first' });
  await first.init();
  const second = new Config({ config: false, snapshot: 'second' });
  await second.init();

  assert.equal(first.options.git.tagMatch, '0.0.0-first.[0-9]*');
  assert.equal(second.options.git.tagMatch, '0.0.0-second.[0-9]*');
  assert.equal(first.options.version.preReleaseId, 'first');
  assert.equal(second.options.version.preReleaseId, 'second');
});

test('named snapshots allow the npm plugin to be disabled', async () => {
  const config = new Config({ config: false, snapshot: 'trial', npm: false });
  await config.init();

  assert.equal(config.options.npm, false);
  assert.equal(config.options.git.tagMatch, '0.0.0-trial.[0-9]*');
  assert.equal(config.options.git.requireUpstream, false);
  assert.equal(config.options.version.increment, 'prerelease');
});

test('snapshot expansion preserves unrelated custom plugin options', async () => {
  const input = {
    config: false,
    snapshot: 'trial',
    git: { push: false, tagName: 'release-${version}', requireBranch: 'custom' },
    npm: { publish: false, tag: 'canary', ignoreVersion: false }
  };
  const original = structuredClone(input);
  const config = new Config(input);
  await config.init();

  assert.equal(config.options.git.push, false);
  assert.equal(config.options.git.tagName, 'release-${version}');
  assert.equal(config.options.git.requireBranch, '!main');
  assert.equal(config.options.npm.publish, false);
  assert.equal(config.options.npm.tag, 'canary');
  assert.equal(config.options.npm.ignoreVersion, true);
  assert.deepEqual(input, original);
});

test('snapshot configuration keeps disabled git behavior', async () => {
  const config = new Config({ config: false, snapshot: 'trial', git: false, npm: { ignoreVersion: false } });
  await config.init();

  assert.equal(config.options.git, false);
  assert.equal(config.options.npm.ignoreVersion, false);
  assert.equal(config.options.version.preReleaseId, 'trial');
});
