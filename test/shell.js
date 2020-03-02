const test = require('ava');
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
  t.is(await exec('pwd'), cwd);
  t.is(await exec('echo ${git.pushArgs}'), '--follow-tags');
  t.is(await exec('echo -*- ${github.tokenRef} -*-'), '-*- GITHUB_TOKEN -*-');
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
