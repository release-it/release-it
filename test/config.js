const test = require('ava');
const isCI = require('is-ci');
const Config = require('../lib/config');
const defaultConfig = require('../conf/release-it.json');
const localConfig = require('../.release-it.json');

test('should contain default values', t => {
  const config = new Config();
  t.deepEqual(config.constructorConfig, {});
  t.deepEqual(config.localConfig, localConfig);
  t.deepEqual(config.localPackageManifestConfig, {});
  t.deepEqual(config.defaultConfig, defaultConfig);
});

test('should merge provided options', t => {
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
  t.is(config.isInteractive, !isCI);
  t.is(options.increment, '1.0.0');
  t.is(options.github.release, true);
});

test('should override --non-interactive', t => {
  const config = new Config({ 'non-interactive': false });
  t.is(config.isInteractive, true);
});

test('should override --no-npm.publish', t => {
  const config = new Config({ npm: { publish: false } });
  t.is(config.options.npm.publish, false);
});

test('should throw if provided config file is not found', t => {
  t.throws(() => new Config({ config: 'nofile' }), /File not found.+nofile/);
});

test('should throw if provided config file is invalid', t => {
  t.throws(() => new Config({ config: '.npmrc' }), /Invalid/);
});

test('should set default increment (for non-interactive mode)', t => {
  const config = new Config({ 'non-interactive': true });
  t.is(config.options.version.increment, 'patch');
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
  const config = new Config({ preRelease: true });
  t.deepEqual(config.options.version, {
    increment: undefined,
    isPreRelease: true,
    preReleaseId: undefined
  });
});

test('should expand pre-release shortcut (without increment)', t => {
  const config = new Config({ preRelease: 'alpha' });
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
