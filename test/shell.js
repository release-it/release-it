const test = require('ava');
const sinon = require('sinon');
const sh = require('shelljs');
const path = require('path');
const { mkTmpDir, readFile, readJSON } = require('./util/helpers');
const { factory } = require('./util');
const Shell = require('../lib/shell');

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
    t.is(shell.log.exec.firstCall.lastArg, 'pwd');
  }
  {
    const actual = await shell.exec('!pwd');
    t.is(actual, undefined);
    t.is(shell.log.exec.callCount, 2);
    t.is(shell.log.exec.secondCall.args[0], 'pwd');
    t.is(shell.log.exec.secondCall.lastArg, true);
  }
});

test('exec (verbose)', async t => {
  const shell = factory(Shell, { global: { isVerbose: true } });
  const actual = await shell.exec('echo foo');
  t.is(shell.log.exec.firstCall.args[0], 'echo foo');
  t.is(shell.log.verbose.firstCall.args[0], 'foo');
  t.is(actual, 'foo');
});

test.serial('pushd + popd', async t => {
  sh.dirs('-cq');
  const dir = 'test/resources';
  const outputPush = await shell.pushd(dir);
  const [to, from] = outputPush.split(',');
  const diff = to
    .replace(from, '')
    .replace(/^[/|\\\\]/, '')
    .replace(/\\/g, '/');
  t.is(diff, dir);
  const popOutput = await shell.popd();
  const trail = popOutput.split(',');
  t.is(trail.length, 1);
});

test('copy', async t => {
  const source = path.resolve(cwd, 'test/resources');
  const target = mkTmpDir();
  await shell.copy(['file*'], target, { cwd: source });
  t.is(await readFile(`${source}/file1`), await readFile(`${target}/file1`));
  t.is(await readFile(`${source}/file2`), await readFile(`${target}/file2`));
});

test('bump', async t => {
  const target = mkTmpDir();
  const manifestA = path.join(target, 'package.json');
  const manifestB = path.join(target, 'lockfile.json');
  sh.cp('package.json', manifestA);
  sh.cp('package.json', manifestB);
  await shell.bump(manifestA, '1.0.0');
  const pkg = await readJSON(manifestA);
  t.is(pkg.version, '1.0.0');
  await shell.bump([manifestA, manifestB], '2.0.0');
  const pkgA = await readJSON(manifestA);
  const pkgB = await readJSON(manifestB);
  t.is(pkgA.version, '2.0.0');
  t.is(pkgB.version, '2.0.0');
});

test('bump (file not found)', async t => {
  const shell = factory(Shell);
  await shell.bump('foo.json');
  t.is(shell.log.warn.firstCall.args[0], 'Could not bump foo.json');
});

test('bump (invalid)', async t => {
  const shell = factory(Shell);
  await shell.bump('test/resources/file1');
  t.is(shell.log.warn.firstCall.args[0], 'Could not bump test/resources/file1');
});

test('bump (none)', async t => {
  const shell = factory(Shell);
  await shell.bump(false);
  await shell.bump(null);
  await shell.bump([]);
  t.is(shell.log.warn.callCount, 0);
});
