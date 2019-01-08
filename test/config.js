const test = require('ava');
const isCI = require('is-ci');
const Config = require('../lib/config');
const defaultConfig = require('../conf/release-it.json');
const localConfig = require('../.release-it.json');
const pkg = require('../package.json');

test('config', t => {
  const config = new Config();
  t.deepEqual(config.constructorConfig, {});
  t.deepEqual(config.localConfig, localConfig);
  t.deepEqual(config.localPackageManifestConfig, {});
  t.deepEqual(config.defaultConfig, defaultConfig);
  t.deepEqual(config.npmConfig, {
    version: pkg.version,
    name: pkg.name,
    private: pkg.private,
    publish: true
  });
});

test('config.mergeOptions', t => {
  const config = new Config({
    increment: '1.0.0',
    debug: true,
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

test('config.mergeOptions (override -n)', t => {
  const config = new Config({ 'non-interactive': false });
  t.is(config.isInteractive, true);
});

test('config (override npm.publish)', t => {
  const config = new Config({ npm: { publish: false } });
  t.is(config.options.npm.publish, false);
});

test('config.config', t => {
  t.throws(() => {
    new Config({ config: 'nofile' });
  }, /File not found.+nofile/);
});

test('config.preRelease (shorthand)', t => {
  const config = new Config({ increment: 'major', preRelease: 'beta' });
  const { options } = config;
  t.is(options.increment, 'major');
  t.is(options.preRelease, true);
  t.is(options.preReleaseId, 'beta');
  t.is(options.npm.tag, 'beta');
});

test('config.preRelease (shorthand w/o npm.tag)', t => {
  const config = new Config({ preRelease: true });
  const { options } = config;
  t.is(options.preRelease, true);
  t.is(options.preReleaseId, null);
  t.is(options.npm.tag, 'latest');
});

test('config.preRelease (shorthand w/ npm.tag)', t => {
  const config = new Config({ preRelease: true, npm: { tag: 'alpha' } });
  const { options } = config;
  t.is(options.preRelease, true);
  t.is(options.preReleaseId, null);
  t.is(options.npm.tag, 'alpha');
});

test('config.preRelease (shorthand w/o increment)', t => {
  const config = new Config({ preRelease: 'alpha' });
  const { options } = config;
  t.is(options.increment, undefined);
  t.is(options.preRelease, true);
  t.is(options.preReleaseId, 'alpha');
  t.is(options.npm.tag, 'alpha');
});

test('config.preRelease (override npm.tag)', t => {
  const config = new Config({ increment: 'minor', preRelease: 'rc', npm: { tag: 'next' } });
  const { options } = config;
  t.is(options.increment, 'minor');
  t.is(options.preRelease, true);
  t.is(options.preReleaseId, 'rc');
  t.is(options.npm.tag, 'next');
});

test('config default increment (non-interactive)', t => {
  const config = new Config({ 'non-interactive': true });
  t.is(config.options.increment, 'patch');
});

test('config default increment (interactive)', t => {
  const config = new Config({ 'non-interactive': false });
  t.is(config.options.increment, undefined);
});
