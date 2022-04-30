#!/usr/bin/env node

import updater from 'update-notifier';
import parseArgs from 'yargs-parser';
import release from '../lib/cli.js';
import { readJSON } from '../lib/util.js';

const pkg = readJSON(new URL('../package.json', import.meta.url));

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
      'parse-numbers': false,
      'camel-case-expansion': false
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
