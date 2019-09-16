const test = require('ava');
const sinon = require('sinon');
const sh = require('shelljs');
const Shell = require('../lib/shell');
const { factory } = require('./util');

const cwd = process.cwd();

const shell = factory(Shell);

test('exec', async t => {
  t.is(await shell.exec('echo bar'), 'bar');
});

test('exec (with context)', async t => {
  const exec = cmd => shell.exec(cmd, { verbose: false }, shell.config.getContext());
  t.is(await exec(''), undefined);
  t.is(await exec('!pwd'), cwd);
  t.is(await exec('echo ${git.pushRepo}'), 'origin');
  t.is(await exec('echo -*- ${github.tokenRef} -*-'), '-*- GITHUB_TOKEN -*-');
});

test.serial('exec (shelljs command)', async t => {
  const stub = sinon.spy(sh, 'pwd');
  await shell.exec('!pwd foo');
  t.is(stub.callCount, 1);
  t.is(stub.firstCall.args[0], 'foo');
  stub.restore();
});

test('exec (dry-run/read-only)', async t => {
  const shell = factory(Shell, { global: { isDryRun: true } });
  {
    const actual = await shell.exec('!pwd', { write: false });
    t.is(actual, cwd);
    t.is(shell.log.exec.callCount, 1);
    t.is(shell.log.exec.firstCall.args[0], 'pwd');
  }
  {
    const actual = await shell.exec('!pwd');
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
