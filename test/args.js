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
