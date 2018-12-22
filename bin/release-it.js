#!/usr/bin/env node

const updater = require('update-notifier');
const pkg = require('../package.json');
const semver = require('semver');
const parseArgs = require('yargs-parser');

if (semver.major(process.version) < 7) {
  console.warn('Deprecation notice: release-it will no longer support Node v6 in the next major release.');
  require('babel-register')({
    only: /release-it\/lib/
  });
}

const release = require('../lib');

const aliases = {
  c: 'config',
  d: 'dry-run',
  e: 'debug',
  h: 'help',
  i: 'increment',
  n: 'non-interactive',
  v: 'version',
  V: 'verbose'
};

const parseCliArguments = args => {
  const options = parseArgs(args, {
    boolean: true,
    alias: aliases,
    default: {
      'dry-run': false,
      verbose: false
    },
    configuration: {
      'parse-numbers': false
    }
  });
  options.increment = options._[0] || options.i;
  if (!options.increment && options.nonInteractive && !options.preRelease) {
    options.increment = 'patch';
  }
  return options;
};

const options = parseCliArguments([].slice.call(process.argv, 2));

updater({ pkg: pkg }).notify();
release(options).then(() => process.exit(0), () => process.exit(1));
