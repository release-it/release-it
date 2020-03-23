const test = require('ava');
const sh = require('shelljs');
const sinon = require('sinon');
const Shell = require('../lib/shell');
const Log = require('../lib/log');
const { factory } = require('./util');

const { stdout } = sh.exec('pwd');
const cwd = stdout.trim();

const shell = factory(Shell);

test('exec', async t => {
  t.is(await shell.exec('echo bar'), 'bar');
});

test('exec (with context)', async t => {
  const exec = cmd => shell.exec(cmd, { verbose: false }, shell.config.getContext());
  t.is(await exec(''), undefined);
  t.is(await exec('pwd'), cwd);
  t.is(await exec('echo ${git.pushArgs}'), '--follow-tags');
  t.is(await exec('echo -*- ${github.tokenRef} -*-'), '-*- GITHUB_TOKEN -*-');
});

test('exec (with args)', async t => {
  t.is(await shell.exec([]), undefined);
  t.is(await shell.exec(['pwd']), cwd);
  t.is(await shell.exec(['echo', 'a', 'b']), 'a b');
  t.is(await shell.exec(['echo', '"a"']), '"a"');
});

test('exec (dry-run/read-only)', async t => {
  const shell = factory(Shell, { global: { isDryRun: true } });
  {
    const actual = await shell.exec('pwd', { write: false });
    t.is(actual, cwd);
    t.is(shell.log.exec.callCount, 1);
    t.is(shell.log.exec.firstCall.args[0], 'pwd');
  }
  {
    const actual = await shell.exec('pwd');
    t.is(actual, undefined);
    t.is(shell.log.exec.callCount, 2);
    t.is(shell.log.exec.secondCall.args[0], 'pwd');
    t.deepEqual(shell.log.exec.secondCall.lastArg, { isDryRun: true });
  }
});

test('exec (verbose)', async t => {
  const shell = factory(Shell, { global: { isVerbose: true } });
  const actual = await shell.exec('echo foo');
  t.is(shell.log.exec.firstCall.args[0], 'echo foo');
  t.is(shell.log.verbose.firstCall.args[0], 'foo');
  t.is(actual, 'foo');
});

test('should cache results of command execution', async t => {
  const log = sinon.createStubInstance(Log);
  const shell = new Shell({ container: { log } });
  const result1 = await shell.exec('echo foo');
  const result2 = await shell.exec('echo foo');
  t.is(result1, result2);
  t.deepEqual(log.exec.args, [
    ['echo foo', { isExternal: false, isCached: false }],
    ['echo foo', { isExternal: false, isCached: true }]
  ]);
});

test('should bail out on failed command execution', async t => {
  const shell = new Shell({ container: { log: sinon.createStubInstance(Log) } });
  await t.throwsAsync(() => shell.exec('foo'));
});
