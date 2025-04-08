#!/usr/bin/env node

import updater from 'update-notifier';
import release from '../lib/cli.js';
import { readJSON } from '../lib/util.js';
import { parseCliArguments } from '../lib/args.js';

const pkg = readJSON(new URL('../package.json', import.meta.url));

const options = parseCliArguments([].slice.call(process.argv, 2));

updater({ pkg: pkg }).notify();
release(options).then(
  () => process.exit(0),
  ({ code }) => process.exit(Number.isInteger(code) ? code : 1)
);
