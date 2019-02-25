const test = require('ava');
const isCI = require('is-ci');
const Config = require('../lib/config');
const defaultConfig = require('../conf/release-it.json');
const localConfig = require('../.release-it.json');
const pkg = require('../package.json');

test('should contain default values', t => {
  const config = new Config();
  t.deepEqual(config.constructorConfig, {});
  t.deepEqual(config.localConfig, localConfig);
  t.deepEqual(config.localPackageManifestConfig, {});
  t.deepEqual(config.defaultConfig, defaultConfig);
  t.deepEqual(config.npmConfig, {
    version: pkg.version,
    name: pkg.name,
    private: pkg.private,
    publish: true,
    publishConfig: pkg.publishConfig
  });
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

test('should expand no-git shortcut', t => {
  const config = new Config({ increment: 'major', git: false });
  const { options } = config;
  t.is(options.git.commit, false);
  t.is(options.git.tag, false);
  t.is(options.git.push, false);
  t.is(options.git.tagName, defaultConfig.git.tagName);
});

test('should expand pre-release shortcut', t => {
  const config = new Config({ increment: 'major', preRelease: 'beta' });
  const { options } = config;
  t.is(options.increment, 'major');
  t.is(options.preRelease, true);
  t.is(options.preReleaseId, 'beta');
  t.is(options.npm.tag, 'beta');
});

test('should expand pre-release shortcut (excluding npm.tag)', t => {
  const config = new Config({ preRelease: true });
  const { options } = config;
  t.is(options.preRelease, true);
  t.is(options.preReleaseId, null);
  t.is(options.npm.tag, 'latest');
});

test('should expand pre-release shortcut (including npm.tag)', t => {
  const config = new Config({ preRelease: true, npm: { tag: 'alpha' } });
  const { options } = config;
  t.is(options.preRelease, true);
  t.is(options.preReleaseId, null);
  t.is(options.npm.tag, 'alpha');
});

test('should expand pre-release shortcut (without increment)', t => {
  const config = new Config({ preRelease: 'alpha' });
  const { options } = config;
  t.is(options.increment, undefined);
  t.is(options.preRelease, true);
  t.is(options.preReleaseId, 'alpha');
  t.is(options.npm.tag, 'alpha');
});

test('should expand pre-release shortcut (including increment and npm.tag)', t => {
  const config = new Config({ increment: 'minor', preRelease: 'rc', npm: { tag: 'next' } });
  const { options } = config;
  t.is(options.increment, 'minor');
  t.is(options.preRelease, true);
  t.is(options.preReleaseId, 'rc');
  t.is(options.npm.tag, 'next');
});

test('should set default increment (for non-interactive mode)', t => {
  const config = new Config({ 'non-interactive': true });
  t.is(config.options.increment, 'patch');
});

test('should not set default increment (for interactive mode)', t => {
  const config = new Config({ 'non-interactive': false });
  t.is(config.options.increment, undefined);
});
