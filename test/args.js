import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCliArguments } from '../lib/args.js';

test('should parse boolean arguments', () => {
  const args = [
    '--dry-run=false',
    '--ci',
    '--github=false',
    '--no-npm',
    '--git.addUntrackedFiles=true',
    '--git.commit=false',
    '--no-git.tag',
    '--git.commitMessage=test'
  ];

  const result = parseCliArguments(args);

  assert.equal(result['dry-run'], false);
  assert.equal(result.ci, true);
  assert.equal(result.github, false);
  assert.equal(result.npm, false);
  assert.equal(result.git.addUntrackedFiles, true);
  assert.equal(result.git.commit, false);
  assert.equal(result.git.tag, false);
  assert.equal(result.git.commitMessage, 'test');
});

test('should parse argument aliases and positionals', () => {
  const result = parseCliArguments(['minor', '-c', '.release-it.json', '-VVV', '--git.pushRepo', 'origin']);

  assert.equal(result.increment, 'minor');
  assert.equal(result.config, '.release-it.json');
  assert.equal(result.c, '.release-it.json');
  assert.equal(result.verbose, 3);
  assert.equal(result.git.pushRepo, 'origin');
});

test('should throw a helpful error when --config is not followed by a file name', () => {
  const args = [
    '--ci',
    '--no-git.commit',
    '--no-npm.publish',
    '--config',
    '--git.pushRepo=gitlab',
    '.release-it.ts',
    '--pre-release'
  ];

  assert.throws(
    () => parseCliArguments(args),
    new Error('Invalid argument: "--config" must be immediately followed by the configuration file name.')
  );
});
