import childProcess from 'node:child_process';
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import Shell from '../lib/shell.js';
import { factory } from './util/index.js';

describe('shell', async () => {
  const cwd = childProcess.execSync('pwd', { encoding: 'utf8' }).trim();

  const shell = await factory(Shell);

  test('exec', async () => {
    assert.equal(await shell.exec('echo bar'), 'bar');
  });

  test('exec (with context)', async () => {
    const exec = cmd => shell.exec(cmd, { verbose: false }, shell.config.getContext());
    assert.equal(await exec(''), undefined);
    assert.equal(await exec('pwd'), cwd);
    assert.equal(await exec('echo ${git.pushArgs}'), '--follow-tags');
    assert.equal(await exec('echo -*- ${github.tokenRef} -*-'), '-*- GITHUB_TOKEN -*-');
  });

  test('exec (with args)', async () => {
    assert.equal(await shell.exec([]), undefined);
    assert.equal(await shell.exec(['pwd']), cwd);
    assert.equal(await shell.exec(['echo', 'a', 'b']), 'a b');
    assert.equal(await shell.exec(['echo', '"a"']), '"a"');
  });

  test('exec (dry-run/read-only)', async () => {
    const shell = await factory(Shell, { options: { 'dry-run': true } });
    {
      const actual = await shell.exec('pwd', { write: false });
      assert.equal(actual, cwd);
      assert.equal(shell.log.exec.mock.callCount(), 1);
      assert.equal(shell.log.exec.mock.calls[0].arguments[0], 'pwd');
    }
    {
      const actual = await shell.exec('pwd');
      assert.equal(actual, undefined);
      assert.equal(shell.log.exec.mock.callCount(), 2);
      assert.equal(shell.log.exec.mock.calls[1].arguments[0], 'pwd');
      assert.deepEqual(shell.log.exec.mock.calls[1].arguments.at(-1), { isDryRun: true });
    }
  });

  test('exec (verbose)', async () => {
    const shell = await factory(Shell, { options: { verbose: true } });
    const actual = await shell.exec('echo foo');
    assert.equal(shell.log.exec.mock.calls[0].arguments[0], 'echo foo');
    assert.equal(shell.log.exec.mock.callCount(), 1);
    assert.equal(shell.log.verbose.mock.calls[0].arguments[0], 'foo');
    assert.equal(shell.log.verbose.mock.callCount(), 1);
    assert.equal(actual, 'foo');
  });

  test('should cache results of command execution', async () => {
    const shell = await factory(Shell);
    const result1 = await shell.exec('echo foo');
    const result2 = await shell.exec('echo foo');
    assert(result1 === result2);
    assert.deepEqual(
      shell.log.exec.mock.calls.map(call => call.arguments),
      [
        ['echo foo', { isExternal: false, isCached: false }],
        ['echo foo', { isExternal: false, isCached: true }]
      ]
    );
  });

  test('should bail out on failed command execution', async () => {
    const shell = new Shell({ container: {} });
    await assert.rejects(shell.exec('foo'));
  });
});
