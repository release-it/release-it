import test from 'tape';
import isCI from 'is-ci';
import Config from '../lib/config';
import defaultConfig from '../conf/release-it.json';
import localConfig from '../.release-it.json';
import pkg from '../package.json';

test('config', t => {
  const config = new Config();
  t.deepEqual(config.cliArguments, {});
  t.deepEqual(config.localOptions, localConfig);
  t.deepEqual(config.defaultOptions, defaultConfig);
  t.deepEqual(config.npm, {
    version: pkg.version,
    name: pkg.name,
    private: pkg.private
  });
  t.end();
});

test('config.parseArgs', t => {
  const config = new Config({}, '1.0.0 --src.commitMessage="release %s" -f');
  const { cliArguments } = config;
  t.equal(cliArguments.force, true);
  t.equal(cliArguments.increment, '1.0.0');
  t.equal(cliArguments.src.commitMessage, 'release %s');
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
  t.equal(config.isForce, false);
  t.equal(config.isDryRun, false);
  t.equal(config.isInteractive, !isCI);
  t.equal(config.isShowVersion, false);
  t.equal(config.isShowHelp, false);
  t.equal(options.increment, '1.0.0');
  t.equal(options.github.release, true);
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
  }, /Could not load.+nofile/);
  t.end();
});

test('config.preRelease (shorthand)', t => {
  const config = new Config({}, 'major --preRelease=beta');
  const { options } = config;
  t.equal(options.increment, 'premajor');
  t.equal(options.preReleaseId, 'beta');
  t.equal(options.github.preRelease, true);
  t.equal(options.npm.tag, 'beta');
  t.end();
});

test('config.preRelease', t => {
  const config = new Config({}, 'minor --preRelease=rc --npm.tag=next');
  const { options } = config;
  t.equal(options.increment, 'preminor');
  t.equal(options.preReleaseId, 'rc');
  t.equal(options.github.preRelease, true);
  t.equal(options.npm.tag, 'next');
  t.end();
});
