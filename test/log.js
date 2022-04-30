import { EOL } from 'node:os';
import test from 'ava';
import mockStdIo from 'mock-stdio';
import stripAnsi from 'strip-ansi';
import Log from '../lib/log.js';

test('should write to stdout', t => {
  const log = new Log();
  mockStdIo.start();
  log.log('foo');
  const { stdout, stderr } = mockStdIo.end();
  t.is(stdout, 'foo\n');
  t.is(stderr, '');
});

test('should write to stderr', t => {
  const log = new Log();
  mockStdIo.start();
  log.error('foo');
  const { stdout, stderr } = mockStdIo.end();
  t.is(stdout, '');
  t.is(stripAnsi(stderr), 'ERROR foo\n');
});

test('should print a warning', t => {
  const log = new Log();
  mockStdIo.start();
  log.warn('foo');
  const { stdout } = mockStdIo.end();
  t.is(stripAnsi(stdout), 'WARNING foo\n');
});

test('should print verbose', t => {
  const log = new Log({ isVerbose: true, verbosityLevel: 2 });
  mockStdIo.start();
  log.verbose('foo');
  const { stdout } = mockStdIo.end();
  t.is(stdout, 'foo\n');
});

test('should print external scripts verbose', t => {
  const log = new Log({ isVerbose: true });
  mockStdIo.start();
  log.verbose('foo', { isExternal: true });
  const { stdout } = mockStdIo.end();
  t.is(stdout, 'foo\n');
});

test('should always print external scripts verbose', t => {
  const log = new Log({ isVerbose: true, verbosityLevel: 2 });
  mockStdIo.start();
  log.verbose('foo', { isExternal: true });
  const { stdout } = mockStdIo.end();
  t.is(stdout, 'foo\n');
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
  t.is(stdout.trim(), '');
});

test('should print command execution (verbose)', t => {
  const log = new Log({ isVerbose: true, verbosityLevel: 2 });
  mockStdIo.start();
  log.exec('foo');
  const { stdout } = mockStdIo.end();
  t.is(stdout.trim(), '$ foo');
});

test('should print command execution (verbose/dry run)', t => {
  const log = new Log({ isVerbose: true });
  mockStdIo.start();
  log.exec('foo', { isDryRun: true, isExternal: true });
  const { stdout } = mockStdIo.end();
  t.is(stdout.trim(), '! foo');
});

test('should print command execution (verbose/external)', t => {
  const log = new Log({ isVerbose: true });
  mockStdIo.start();
  log.exec('foo', { isExternal: true });
  const { stdout } = mockStdIo.end();
  t.is(stdout.trim(), '$ foo');
});

test('should print command execution (dry run)', t => {
  const log = new Log({ isDryRun: true });
  mockStdIo.start();
  log.exec('foo');
  const { stdout } = mockStdIo.end();
  t.is(stdout, '$ foo\n');
});

test('should print command execution (read-only)', t => {
  const log = new Log({ isDryRun: true });
  mockStdIo.start();
  log.exec('foo', 'bar', false);
  const { stdout } = mockStdIo.end();
  t.is(stdout, '$ foo bar\n');
});

test('should print command execution (write)', t => {
  const log = new Log({ isDryRun: true });
  mockStdIo.start();
  log.exec('foo', '--arg n', { isDryRun: true });
  const { stdout } = mockStdIo.end();
  t.is(stdout, '! foo --arg n\n');
});

test('should print obtrusive', t => {
  const log = new Log({ isCI: false });
  mockStdIo.start();
  log.obtrusive('spacious');
  const { stdout } = mockStdIo.end();
  t.is(stdout, '\nspacious\n\n');
});

test('should not print obtrusive in CI mode', t => {
  const log = new Log({ isCI: true });
  mockStdIo.start();
  log.obtrusive('normal');
  const { stdout } = mockStdIo.end();
  t.is(stdout, 'normal\n');
});

test('should print preview', t => {
  const log = new Log();
  mockStdIo.start();
  log.preview({ title: 'title', text: 'changelog' });
  const { stdout } = mockStdIo.end();
  t.is(stripAnsi(stdout), `Title:${EOL}changelog\n`);
});
