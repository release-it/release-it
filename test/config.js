import test from 'tape';
import Config from '../lib/config';
import defaultConfig from '../conf/release.json';
import localConfig from '../.release.json';
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
  const config = new Config({}, '1.0.0 --message="release %s" -f');
  const { cliArguments } = config;
  t.equal(cliArguments.force, true);
  t.equal(cliArguments.increment, '1.0.0');
  t.equal(cliArguments.src.commitMessage, 'release %s');
  t.equal(cliArguments.dist.commitMessage, 'release %s');
  t.end();
});

test('config.mergeOptions', t => {
  const config = new Config({}, '1.0.0 -eV --github.release');
  const { options } = config;
  t.equal(config.isVerbose, true);
  t.equal(config.isForce, false);
  t.equal(config.isDryRun, false);
  t.equal(config.isInteractive, true);
  t.equal(options.increment, '1.0.0');
  t.equal(options.github.release, true);
  t.end();
});
