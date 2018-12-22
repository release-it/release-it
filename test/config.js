const test = require('tape');
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
  t.end();
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
  t.equal(config.isVerbose, true);
  t.equal(config.isDryRun, false);
  t.equal(config.isInteractive, !isCI);
  t.equal(options.increment, '1.0.0');
  t.equal(options.github.release, true);
  t.end();
});

test('config.mergeOptions (override -n)', t => {
  const config = new Config({ 'non-interactive': false });
  t.equal(config.isInteractive, true);
  t.end();
});

test('config (override npm.publish)', t => {
  const config = new Config({ npm: { publish: false } });
  t.equal(config.options.npm.publish, false);
  t.end();
});

test('config.config', t => {
  t.throws(() => {
    new Config({ config: 'nofile' });
  }, /File not found.+nofile/);
  t.end();
});

test('config.preRelease (shorthand)', t => {
  const config = new Config({ increment: 'major', preRelease: 'beta' });
  const { options } = config;
  t.equal(options.increment, 'major');
  t.equal(options.preRelease, true);
  t.equal(options.preReleaseId, 'beta');
  t.equal(options.npm.tag, 'beta');
  t.end();
});

test('config.preRelease (shorthand w/o npm.tag)', t => {
  const config = new Config({ preRelease: true });
  const { options } = config;
  t.equal(options.preRelease, true);
  t.equal(options.preReleaseId, null);
  t.equal(options.npm.tag, 'latest');
  t.end();
});

test('config.preRelease (shorthand w/ npm.tag)', t => {
  const config = new Config({ preRelease: true, npm: { tag: 'alpha' } });
  const { options } = config;
  t.equal(options.preRelease, true);
  t.equal(options.preReleaseId, null);
  t.equal(options.npm.tag, 'alpha');
  t.end();
});

test('config.preRelease (shorthand w/o increment)', t => {
  const config = new Config({ preRelease: 'alpha' });
  const { options } = config;
  t.equal(options.increment, null);
  t.equal(options.preRelease, true);
  t.equal(options.preReleaseId, 'alpha');
  t.equal(options.npm.tag, 'alpha');
  t.end();
});

test('config.preRelease (override npm.tag)', t => {
  const config = new Config({ increment: 'minor', preRelease: 'rc', npm: { tag: 'next' } });
  const { options } = config;
  t.equal(options.increment, 'minor');
  t.equal(options.preRelease, true);
  t.equal(options.preReleaseId, 'rc');
  t.equal(options.npm.tag, 'next');
  t.end();
});
