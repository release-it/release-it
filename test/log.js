import { EOL } from 'node:os';
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { stripVTControlCharacters } from 'node:util';
import mockStdIo from 'mock-stdio';
import Log from '../lib/log.js';

describe('log', () => {
  test('should write to stdout', () => {
    const log = new Log();
    mockStdIo.start();
    log.log('foo');
    const { stdout, stderr } = mockStdIo.end();
    assert.equal(stdout, 'foo\n');
    assert.equal(stderr, '');
  });

  test('should write to stderr', () => {
    const log = new Log();
    mockStdIo.start();
    log.error('foo');
    const { stdout, stderr } = mockStdIo.end();
    assert.equal(stdout, '');
    assert.equal(stripVTControlCharacters(stderr), 'ERROR foo\n');
  });

  test('should print a warning', () => {
    const log = new Log();
    mockStdIo.start();
    log.warn('foo');
    const { stderr } = mockStdIo.end();
    assert.equal(stripVTControlCharacters(stderr), 'WARNING foo\n');
  });

  test('should print verbose', () => {
    const log = new Log({ isVerbose: true, verbosityLevel: 2 });
    mockStdIo.start();
    log.verbose('foo');
    const { stderr } = mockStdIo.end();
    assert.equal(stderr, 'foo\n');
  });

  test('should print external scripts verbose', () => {
    const log = new Log({ isVerbose: true });
    mockStdIo.start();
    log.verbose('foo', { isExternal: true });
    const { stderr } = mockStdIo.end();
    assert.equal(stderr, 'foo\n');
  });

  test('should always print external scripts verbose', () => {
    const log = new Log({ isVerbose: true, verbosityLevel: 2 });
    mockStdIo.start();
    log.verbose('foo', { isExternal: true });
    const { stderr } = mockStdIo.end();
    assert.equal(stderr, 'foo\n');
  });

  test('should not print verbose by default', () => {
    const log = new Log();
    mockStdIo.start();
    log.verbose('foo');
    const { stderr } = mockStdIo.end();
    assert.equal(stderr, '');
  });

  test('should not print command execution by default', () => {
    const log = new Log();
    mockStdIo.start();
    log.exec('foo');
    const { stderr } = mockStdIo.end();
    assert.equal(stderr.trim(), '');
  });

  test('should print command execution (verbose)', () => {
    const log = new Log({ isVerbose: true, verbosityLevel: 2 });
    mockStdIo.start();
    log.exec('foo');
    const { stderr } = mockStdIo.end();
    assert.equal(stderr.trim(), '$ foo');
  });

  test('should print command execution (verbose/dry run)', () => {
    const log = new Log({ isVerbose: true });
    mockStdIo.start();
    log.exec('foo', { isDryRun: true, isExternal: true });
    const { stderr } = mockStdIo.end();
    assert.equal(stderr.trim(), '! foo');
  });

  test('should print command execution (verbose/external)', () => {
    const log = new Log({ isVerbose: true });
    mockStdIo.start();
    log.exec('foo', { isExternal: true });
    const { stderr } = mockStdIo.end();
    assert.equal(stderr.trim(), '$ foo');
  });

  test('should print command execution (dry run)', () => {
    const log = new Log({ isDryRun: true });
    mockStdIo.start();
    log.exec('foo');
    const { stderr } = mockStdIo.end();
    assert.equal(stderr, '$ foo\n');
  });

  test('should print command execution (read-only)', () => {
    const log = new Log({ isDryRun: true });
    mockStdIo.start();
    log.exec('foo', 'bar', false);
    const { stderr } = mockStdIo.end();
    assert.equal(stderr, '$ foo bar\n');
  });

  test('should print command execution (write)', () => {
    const log = new Log({ isDryRun: true });
    mockStdIo.start();
    log.exec('foo', '--arg n', { isDryRun: true });
    const { stderr } = mockStdIo.end();
    assert.equal(stderr, '! foo --arg n\n');
  });

  test('should print obtrusive', () => {
    const log = new Log({ isCI: false });
    mockStdIo.start();
    log.obtrusive('spacious');
    const { stdout } = mockStdIo.end();
    assert.equal(stdout, '\nspacious\n\n');
  });

  test('should not print obtrusive in CI mode', () => {
    const log = new Log({ isCI: true });
    mockStdIo.start();
    log.obtrusive('normal');
    const { stdout } = mockStdIo.end();
    assert.equal(stdout, 'normal\n');
  });

  test('should print preview', () => {
    const log = new Log();
    mockStdIo.start();
    log.preview({ title: 'title', text: 'changelog' });
    const { stdout } = mockStdIo.end();
    assert.equal(stripVTControlCharacters(stdout), `Title:${EOL}changelog\n`);
  });
});
