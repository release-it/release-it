import test from 'node:test';
import assert from 'node:assert/strict';
import mockStdIo from 'mock-stdio';
import { version, help } from '../lib/cli.js';
import { readJSON } from '../lib/util.js';

const pkg = readJSON(new URL('../package.json', import.meta.url));

test('should print version', () => {
  mockStdIo.start();
  version();
  const { stdout } = mockStdIo.end();
  assert.equal(stdout, `v${pkg.version}\n`);
});

test('should print help', () => {
  mockStdIo.start();
  help();
  const { stdout } = mockStdIo.end();
  assert.match(stdout, new RegExp(`Release It!.+${pkg.version}`));
});
