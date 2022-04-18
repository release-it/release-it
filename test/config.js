import test from 'ava';
import isCI from 'is-ci';
import Config from '../lib/config.js';
import { readJSON } from '../lib/util.js';

const defaultConfig = readJSON(new URL('../config/release-it.json', import.meta.url));
const projectConfig = readJSON(new URL('../.release-it.json', import.meta.url));

const localConfig = { github: { release: true } };

test("should read this project's own configuration", t => {
  const config = new Config();
  t.deepEqual(config.constructorConfig, {});
  t.deepEqual(config.localConfig, projectConfig);
  t.deepEqual(config.defaultConfig, defaultConfig);
});

test('should contain default values', t => {
  const config = new Config({ configDir: './test/stub/config/default' });
  t.deepEqual(config.constructorConfig, { configDir: './test/stub/config/default' });
  t.deepEqual(config.localConfig, localConfig);
  t.deepEqual(config.defaultConfig, defaultConfig);
});

test('should merge provided options', t => {
  const config = new Config({
    configDir: './test/stub/config/merge',
    increment: '1.0.0',
    verbose: true,
    github: {
      release: true
    }
  });
  const { options } = config;
  t.is(config.isVerbose, true);
  t.is(config.isDryRun, false);
  t.is(options.increment, '1.0.0');
  t.is(options.git.push, false);
  t.is(options.github.release, true);
});

test('should set CI mode', t => {
  const config = new Config({ ci: true });
  t.is(config.isCI, true);
});

test('should detect CI mode', t => {
  const config = new Config();
  t.is(config.options.ci, isCI);
  t.is(config.isCI, isCI);
});

test('should override --no-npm.publish', t => {
  const config = new Config({ npm: { publish: false } });
  t.is(config.options.npm.publish, false);
});

test('should read YAML config', t => {
  const config = new Config({ configDir: './test/stub/config/yaml' });
  t.deepEqual(config.options.foo, { bar: 1 });
});

test('should read YML config', t => {
  const config = new Config({ configDir: './test/stub/config/yml' });
  t.deepEqual(config.options.foo, { bar: 1 });
});

test('should read TOML config', t => {
  const config = new Config({ configDir: './test/stub/config/toml' });
  t.deepEqual(config.options.foo, { bar: 1 });
});

test('should throw if provided config file is not found', t => {
  t.throws(() => new Config({ config: 'nofile' }), { message: /no such file.+nofile/ });
});

test('should throw if provided config file is invalid (cosmiconfig exception)', t => {
  t.throws(() => new Config({ config: './test/stub/config/invalid-config-txt' }), {
    message: /Invalid configuration file at/
  });
});

test('should throw if provided config file is invalid (no object)', t => {
  t.throws(() => new Config({ config: './test/stub/config/invalid-config-rc' }), {
    message: /Invalid configuration file at/
  });
});

test('should not set default increment (for CI mode)', t => {
  const config = new Config({ ci: true });
  t.is(config.options.version.increment, undefined);
});

test('should not set default increment (for interactive mode)', t => {
  const config = new Config({ ci: false });
  t.is(config.options.version.increment, undefined);
});

test('should expand pre-release shortcut', t => {
  const config = new Config({ increment: 'major', preRelease: 'beta' });
  t.deepEqual(config.options.version, {
    increment: 'major',
    isPreRelease: true,
    preReleaseId: 'beta'
  });
});

test('should expand pre-release shortcut (preRelease boolean)', t => {
  const config = new Config({ ci: true, preRelease: true });
  t.deepEqual(config.options.version, {
    increment: undefined,
    isPreRelease: true,
    preReleaseId: undefined
  });
});

test('should expand pre-release shortcut (without increment)', t => {
  const config = new Config({ ci: false, preRelease: 'alpha' });
  t.deepEqual(config.options.version, {
    increment: undefined,
    isPreRelease: true,
    preReleaseId: 'alpha'
  });
});

test('should expand pre-release shortcut (including increment and npm.tag)', t => {
  const config = new Config({ increment: 'minor', preRelease: 'rc' });
  t.deepEqual(config.options.version, {
    increment: 'minor',
    isPreRelease: true,
    preReleaseId: 'rc'
  });
});
