#!/usr/bin/env node

import release from '../lib/cli.js';
import { parseCliArguments } from '../lib/args.js';

let options;

try {
  options = parseCliArguments([].slice.call(process.argv, 2));
} catch (error) {
  console.error(`ERROR ${error.message}`);
  process.exit(1);
}

release(options).then(
  () => process.exit(0),
  ({ code }) => process.exit(Number.isInteger(code) ? code : 1)
);
