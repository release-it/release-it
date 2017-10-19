import test from 'tape';
import mockStdIo from 'mock-stdio';
import pkg from '../package.json';
import { version, help } from '../lib/cli';

test('version', t => {
  mockStdIo.start();
  version();
  const { stdout } = mockStdIo.end();
  t.equal(stdout, `v${pkg.version}\n`);
  t.end();
});

test('help', t => {
  mockStdIo.start();
  help();
  const { stdout } = mockStdIo.end();
  t.ok(RegExp(`Release It!.+${pkg.version}`).test(stdout));
  t.end();
});
