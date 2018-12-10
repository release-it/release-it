const test = require('tape');
const isCI = require('is-ci');
const { Config } = require('../lib/config');
const defaultConfig = require('../conf/release-it.json');
const localConfig = require('../.release-it.json');
const pkg = require('../package.json');

test('config', t => {
  const config = new Config();
  t.deepEqual(config.cliArguments, {});
  t.deepEqual(config.localOptions, localConfig);
  t.deepEqual(config.localPkgOptions, {});
  t.deepEqual(config.defaultOptions, defaultConfig);
  t.deepEqual(config.npm, {
    version: pkg.version,
    name: pkg.name,
    private: pkg.private
  });
  t.end();
});

test('config.parseArgs', t => {
  const config = new Config({}, '1.0.0 --git.commitMessage="release ${version}" -V');
  const { cliArguments } = config;
  t.equal(cliArguments.verbose, true);
  t.equal(cliArguments.increment, '1.0.0');
  t.equal(cliArguments.git.commitMessage, 'release ${version}');
  t.end();
});

test('config.parseArgs (--increment)', t => {
  const config = new Config({}, '--increment=1.0.0');
  t.equal(config.cliArguments.increment, '1.0.0');
  t.end();
});

test('config.parseArgs (-i)', t => {
  const config = new Config({}, '-i 1.0.0');
  t.equal(config.cliArguments.increment, '1.0.0');
  t.end();
});

test('config.mergeOptions', t => {
  const config = new Config({}, '1.0.0 -eV --github.release');
  const { options } = config;
  t.equal(config.isVerbose, true);
  t.equal(config.isDryRun, false);
  t.equal(config.isInteractive, !isCI);
  t.equal(config.isShowVersion, false);
  t.equal(config.isShowHelp, false);
  t.equal(options.increment, '1.0.0');
  t.equal(options.github.release, true);
  t.end();
});

test('config.assignOptions', t => {
  const config = new Config({}, '1.0.0 -eV --github.release');
  const options = {
    verbose: false,
    increment: 'major',
    github: {
      release: false
    }
  };
  config.assignOptions(options);
  t.equal(config.isVerbose, false);
  t.equal(config.options.increment, 'major');
  t.equal(config.options.github.release, false);
  t.end();
});

test('config.mergeOptions (override -n)', t => {
  const config = new Config({}, '--no-n');
  t.equal(config.isInteractive, true);
  t.end();
});

test('config.config', t => {
  t.throws(() => {
    new Config({ config: 'nofile' });
  }, /File not found.+nofile/);
  t.end();
});

test('config.preRelease (shorthand)', t => {
  const config = new Config({}, 'major --preRelease=beta');
  const { options } = config;
  t.equal(options.increment, 'major');
  t.equal(options.preReleaseId, 'beta');
  t.equal(options.github.preRelease, true);
  t.equal(options.npm.tag, 'beta');
  t.end();
});

test('config.preRelease (shorthand w/o increment)', t => {
  const config = new Config({}, '--preRelease=alpha');
  const { options } = config;
  t.equal(options.increment, null);
  t.equal(options.preReleaseId, 'alpha');
  t.equal(options.github.preRelease, true);
  t.equal(options.npm.tag, 'alpha');
  t.end();
});

test('config.preRelease (override npm.tag)', t => {
  const config = new Config({}, 'minor --preRelease=rc --npm.tag=next');
  const { options } = config;
  t.equal(options.increment, 'minor');
  t.equal(options.preReleaseId, 'rc');
  t.equal(options.github.preRelease, true);
  t.equal(options.npm.tag, 'next');
  t.end();
});
