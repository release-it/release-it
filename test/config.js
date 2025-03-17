import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { isCI } from 'ci-info';
import Config from '../lib/config.js';
import { readJSON } from '../lib/util.js';

const defaultConfig = readJSON(new URL('../config/release-it.json', import.meta.url));
const projectConfig = readJSON(new URL('../.release-it.json', import.meta.url));

const localConfig = { github: { release: true } };

describe('config', () => {
  test("should read this project's own configuration", () => {
    const config = new Config();
    assert.deepEqual(config.constructorConfig, {});
    assert.deepEqual(config.localConfig, projectConfig);
    assert.deepEqual(config.defaultConfig, defaultConfig);
  });

  test('should contain default values', () => {
    const config = new Config({ configDir: './test/stub/config/default' });
    assert.deepEqual(config.constructorConfig, { configDir: './test/stub/config/default' });
    assert.deepEqual(config.localConfig, localConfig);
    assert.deepEqual(config.defaultConfig, defaultConfig);
  });

  test('should merge provided options', () => {
    const config = new Config({
      configDir: './test/stub/config/merge',
      increment: '1.0.0',
      verbose: true,
      github: {
        release: true
      }
    });
    const { options } = config;
    assert.equal(config.isVerbose, true);
    assert.equal(config.isDryRun, false);
    assert.equal(options.increment, '1.0.0');
    assert.equal(options.git.push, false);
    assert.equal(options.github.release, true);
  });

  test('should set CI mode', () => {
    const config = new Config({ ci: true });
    assert.equal(config.isCI, true);
  });

  test('should detect CI mode', () => {
    const config = new Config();
    assert.equal(config.options.ci, isCI);
    assert.equal(config.isCI, isCI);
  });

  test('should override --no-npm.publish', () => {
    const config = new Config({ npm: { publish: false } });
    assert.equal(config.options.npm.publish, false);
  });

  test('should read YAML config', () => {
    const config = new Config({ configDir: './test/stub/config/yaml' });
    assert.deepEqual(config.options.foo, { bar: 1 });
  });

  test('should read YML config', () => {
    const config = new Config({ configDir: './test/stub/config/yml' });
    assert.deepEqual(config.options.foo, { bar: 1 });
  });

  test('should read TOML config', () => {
    const config = new Config({ configDir: './test/stub/config/toml' });
    assert.deepEqual(config.options.foo, { bar: 1 });
  });

  test('should throw if provided config file is not found', () => {
    assert.throws(() => new Config({ config: 'nofile' }), /no such file.+nofile/);
  });

  test('should throw if provided config file is invalid (cosmiconfig exception)', () => {
    assert.throws(
      () => new Config({ config: './test/stub/config/invalid-config-txt' }),
      /Invalid configuration file at/
    );
  });

  test('should throw if provided config file is invalid (no object)', () => {
    assert.throws(
      () => new Config({ config: './test/stub/config/invalid-config-rc' }),
      /Invalid configuration file at/
    );
  });

  test('should not set default increment (for CI mode)', () => {
    const config = new Config({ ci: true });
    assert.equal(config.options.version.increment, undefined);
  });

  test('should not set default increment (for interactive mode)', () => {
    const config = new Config({ ci: false });
    assert.equal(config.options.version.increment, undefined);
  });

  test('should expand pre-release shortcut', () => {
    const config = new Config({ increment: 'major', preRelease: 'beta' });
    assert.deepEqual(config.options.version, {
      increment: 'major',
      isPreRelease: true,
      preReleaseBase: undefined,
      preReleaseId: 'beta'
    });
  });

  test('should expand pre-release shortcut (preRelease boolean)', () => {
    const config = new Config({ ci: true, preRelease: true });
    assert.deepEqual(config.options.version, {
      increment: undefined,
      isPreRelease: true,
      preReleaseBase: undefined,
      preReleaseId: undefined
    });
  });

  test('should expand pre-release shortcut (without increment)', () => {
    const config = new Config({ ci: false, preRelease: 'alpha' });
    assert.deepEqual(config.options.version, {
      increment: undefined,
      isPreRelease: true,
      preReleaseBase: undefined,
      preReleaseId: 'alpha'
    });
  });

  test('should expand pre-release shortcut (including increment and npm.tag)', () => {
    const config = new Config({ increment: 'minor', preRelease: 'rc' });
    assert.deepEqual(config.options.version, {
      increment: 'minor',
      isPreRelease: true,
      preReleaseBase: undefined,
      preReleaseId: 'rc'
    });
  });

  test('should use pre-release base', () => {
    const config = new Config({ increment: 'minor', preRelease: 'next', preReleaseBase: '1' });
    assert.deepEqual(config.options.version, {
      increment: 'minor',
      isPreRelease: true,
      preReleaseBase: '1',
      preReleaseId: 'next'
    });
  });

  test('should expand pre-release shortcut (snapshot)', () => {
    const config = new Config({ snapshot: 'feat' });
    assert.deepEqual(config.options.version, {
      increment: 'prerelease',
      isPreRelease: true,
      preReleaseBase: undefined,
      preReleaseId: 'feat'
    });
    assert.equal(config.options.git.tagMatch, '0.0.0-feat.[0-9]*');
    assert.equal(config.options.git.getLatestTagFromAllRefs, true);
  });
});
