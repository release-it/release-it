#!/usr/bin/env node

import release from '../lib/cli.js';
import { parseCliArguments } from '../lib/args.js';

const options = parseCliArguments([].slice.call(process.argv, 2));

release(options).then(
  () => process.exit(0),
  ({ code }) => process.exit(Number.isInteger(code) ? code : 1)
);
