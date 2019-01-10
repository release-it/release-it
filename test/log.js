const { EOL } = require('os');
const test = require('ava');
const sinon = require('sinon');
const mockStdIo = require('mock-stdio');
const Log = require('../lib/log');
const Config = require('../lib/config');

test('should write to stdout', t => {
  const log = new Log();
  mockStdIo.start();
  log.log('foo');
  const { stdout, stderr } = mockStdIo.end();
  t.is(stdout, `foo${EOL}`);
  t.is(stderr, '');
});

test('should write to stderr', t => {
  const log = new Log();
  mockStdIo.start();
  log.error('foo');
  const { stdout, stderr } = mockStdIo.end();
  t.is(stdout, '');
  t.true(stderr.endsWith(`foo${EOL}`));
});

test('should print warning', t => {
  const log = new Log();
  mockStdIo.start();
  log.warn('foo');
  const { stdout } = mockStdIo.end();
  t.true(stdout.endsWith(`foo${EOL}`));
});

test('should print verbose', t => {
  const log = new Log({ isVerbose: true });
  mockStdIo.start();
  log.verbose('foo');
  const { stdout } = mockStdIo.end();
  t.is(stdout, `foo${EOL}`);
});

test('should not print verbose by default', t => {
  const log = new Log();
  mockStdIo.start();
  log.verbose('foo');
  const { stdout } = mockStdIo.end();
  t.is(stdout, '');
});

test('should not print command execution by default', t => {
  const log = new Log();
  mockStdIo.start();
  log.exec('foo');
  const { stdout } = mockStdIo.end();
  t.is(stdout, '');
});

test('should print command execution (verbose)', t => {
  const log = new Log({ isVerbose: true });
  mockStdIo.start();
  log.exec('foo');
  const { stdout } = mockStdIo.end();
  t.is(stdout, `! foo${EOL}`);
});

test('should print command execution (dry run)', t => {
  const log = new Log({ isDryRun: true });
  mockStdIo.start();
  log.exec('foo');
  const { stdout } = mockStdIo.end();
  t.is(stdout, `! foo${EOL}`);
});

test('should print command execution (read-only)', t => {
  const log = new Log({ isDryRun: true });
  mockStdIo.start();
  log.exec('foo', 'bar', true);
  const { stdout } = mockStdIo.end();
  t.is(stdout, `! foo bar${EOL}`);
});

test('should print command execution (write)', t => {
  const log = new Log({ isDryRun: true });
  mockStdIo.start();
  log.exec('foo', '--arg n', false);
  const { stdout } = mockStdIo.end();
  t.is(stdout, `$ foo --arg n${EOL}`);
});
