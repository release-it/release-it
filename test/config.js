const test = require('ava');
const mock = require('mock-fs');
const isCI = require('is-ci');
const Config = require('../lib/config');
const defaultConfig = require('../conf/release-it.json');

const localConfig = { github: { release: true } };

test.afterEach(() => mock.restore());

test('should contain default values', t => {
  mock({ '../.release-it.json': JSON.stringify(localConfig) });
  const config = new Config();
  t.deepEqual(config.constructorConfig, {});
  t.deepEqual(config.localConfig, localConfig);
  t.deepEqual(config.defaultConfig, defaultConfig);
});

test('should merge provided options', t => {
  mock({
    'package.json': JSON.stringify({ 'release-it': { git: { push: false } } }),
    '../.release-it.json': JSON.stringify(localConfig)
  });
  const config = new Config({
    increment: '1.0.0',
    verbose: true,
    github: {
      release: true
    }
  });
  const { options } = config;
  t.is(config.isVerbose, true);
  t.is(config.isDryRun, false);
  t.is(config.isCI, isCI);
  t.is(options.increment, '1.0.0');
  t.is(options.git.push, false);
  t.is(options.github.release, true);
});

test('should set CI mode', t => {
  const config = new Config({ ci: true });
  t.is(config.isCI, true);
});

test('should set --ci (backwards compat)', t => {
  const config = new Config({ 'non-interactive': false });
  t.is(config.isCI, false);
});

test('should override --no-npm.publish', t => {
  const config = new Config({ npm: { publish: false } });
  t.is(config.options.npm.publish, false);
});

test('should read YAML config', t => {
  mock({ '.release-it.yaml': 'foo:\n  bar: 1' });
  const config = new Config({ config: '.release-it.yaml' });
  t.deepEqual(config.options.foo, { bar: 1 });
});

test('should read TOML config', t => {
  mock({ '.release-it.toml': '[foo]\nbar=1' });
  const config = new Config({ config: '.release-it.toml' });
  t.deepEqual(config.options.foo, { bar: 1 });
});

test('should throw if provided config file is not found', t => {
  t.throws(() => new Config({ config: 'nofile' }), /no such file.+nofile/);
});

test('should throw if provided config file is invalid (cosmiconfig exception)', t => {
  mock({ 'invalid-config-txt': 'foo\nbar\baz' });
  t.throws(() => new Config({ config: 'invalid-config-txt' }), { name: 'YAMLException' });
});

test('should throw if provided config file is invalid (no object)', t => {
  mock({ 'invalid-config-rc': 'foo=bar' });
  t.throws(() => new Config({ config: 'invalid-config-rc' }), /Invalid configuration file at/);
});

test('should not set default increment (for CI mode)', t => {
  const config = new Config({ 'non-interactive': true });
  t.is(config.options.version.increment, undefined);
});

test('should not set default increment (for interactive mode)', t => {
  const config = new Config({ 'non-interactive': false });
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
  const config = new Config({ 'non-interactive': true, preRelease: true });
  t.deepEqual(config.options.version, {
    increment: undefined,
    isPreRelease: true,
    preReleaseId: undefined
  });
});

test('should expand pre-release shortcut (without increment)', t => {
  const config = new Config({ 'non-interactive': false, preRelease: 'alpha' });
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
