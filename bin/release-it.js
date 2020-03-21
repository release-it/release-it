#!/usr/bin/env node

const updater = require('update-notifier');
const parseArgs = require('yargs-parser');
const pkg = require('../package.json');
const release = require('../lib');

const aliases = {
  c: 'config',
  d: 'dry-run',
  h: 'help',
  i: 'increment',
  v: 'version',
  V: 'verbose'
};

const parseCliArguments = args => {
  const options = parseArgs(args, {
    boolean: ['dry-run', 'ci'],
    alias: aliases,
    configuration: {
      'parse-numbers': false
    }
  });
  if (options.V) {
    options.verbose = typeof options.V === 'boolean' ? options.V : options.V.length;
    delete options.V;
  }
  options.increment = options._[0] || options.i;
  return options;
};

const options = parseCliArguments([].slice.call(process.argv, 2));

updater({ pkg: pkg }).notify();
release(options).then(
  () => process.exit(0),
  () => process.exit(1)
);
