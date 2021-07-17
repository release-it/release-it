import test from 'ava';
import mockStdIo from 'mock-stdio';
import pkg from '../package.json';
import { version, help } from '../lib/cli';

test('should print version', t => {
  mockStdIo.start();
  version();
  const { stdout } = mockStdIo.end();
  t.is(stdout, `v${pkg.version}\n`);
});

test('should print help', t => {
  mockStdIo.start();
  help();
  const { stdout } = mockStdIo.end();
  t.regex(stdout, RegExp(`Release It!.+${pkg.version}`));
});
