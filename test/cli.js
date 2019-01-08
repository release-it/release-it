const test = require('ava');
const mockStdIo = require('mock-stdio');
const pkg = require('../package.json');
const { version, help } = require('../lib/cli');

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
