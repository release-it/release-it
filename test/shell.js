const test = require('tape');
const sinon = require('sinon');
const sh = require('shelljs');
const mockStdIo = require('mock-stdio');
const path = require('path');
const { EOL } = require('os');
const { readFile, readJSON } = require('./util/index');
const Shell = require('../lib/shell');

const dir = 'test/resources';
const cwd = process.cwd();

const shell = new Shell();

test('run (shell.exec)', async t => {
  t.equal(await shell.run('echo bar'), 'bar');
  t.end();
});

test('run (shelljs command)', async t => {
  const stub = sinon.spy(sh, 'pwd');
  await shell.run('!pwd foo');
  t.equal(stub.callCount, 1);
  t.equal(stub.firstCall.args[0], 'foo');
  stub.restore();
  t.end();
});

test('run (dry-run/read-only)', async t => {
  const shell = new Shell({ isDryRun: true });
  {
    mockStdIo.start();
    const actual = await shell.run('!pwd', { isReadOnly: true });
    const { stdout } = mockStdIo.end();
    t.equal(actual, cwd);
    t.ok(/\$ pwd/.test(stdout));
    t.notOk(/not executed in dry run/.test(stdout));
  }
  {
    mockStdIo.start();
    const actual = await shell.run('!pwd', { isReadOnly: false });
    const { stdout } = mockStdIo.end();
    t.equal(actual, undefined);
    t.ok(/\$ pwd/.test(stdout));
    t.ok(/not executed in dry run/.test(stdout));
  }
  t.end();
});

test('run (verbose)', async t => {
  const shell = new Shell({ isVerbose: true });
  mockStdIo.start();
  const actual = await shell.run('echo foo');
  const { stdout } = mockStdIo.end();
  t.equal(stdout, `$ echo foo\nfoo${EOL}`);
  t.equal(actual, 'foo');
  t.end();
});

test('runTemplateCommand', async t => {
  const run = cmd => shell.runTemplateCommand(cmd, { verbose: false });
  t.equal(await run(''), undefined);
  t.equal(await run('!pwd'), cwd);
  t.equal(await run('echo ${git.pushRepo}'), 'origin');
  t.equal(await run('echo -*- ${github.tokenRef} -*-'), '-*- GITHUB_TOKEN -*-');
  t.end();
});

test('pushd + popd', async t => {
  const outputPush = await shell.pushd(dir);
  const [to, from] = outputPush.split(',');
  const diff = to
    .replace(from, '')
    .replace(/^[/|\\\\]/, '')
    .replace(/\\/g, '/');
  t.equal(diff, dir);
  const popOutput = await shell.popd();
  const trail = popOutput.split(',');
  t.equal(trail.length, 1);
  t.end();
});

test('copy', async t => {
  sh.pushd('-q', dir);
  sh.mkdir('tmp');
  await shell.copy(['file*'], {}, 'tmp');
  t.equal(await readFile('file1'), await readFile('tmp/file1'));
  t.equal(await readFile('file2'), await readFile('tmp/file2'));
  sh.rm('-rf', 'tmp');
  sh.popd('-q');
  t.end();
});

test('bump', async t => {
  const target = path.resolve(dir);
  const manifestA = path.join(target, 'package.json');
  const manifestB = path.join(target, 'lockfile.json');
  sh.cp('package.json', manifestA);
  sh.cp('package.json', manifestB);
  await shell.bump(manifestA, '1.0.0');
  const pkg = await readJSON(manifestA);
  t.equal(pkg.version, '1.0.0');
  await shell.bump([manifestA, manifestB], '2.0.0');
  const pkgA = await readJSON(manifestA);
  const pkgB = await readJSON(manifestB);
  t.equal(pkgA.version, '2.0.0');
  t.equal(pkgB.version, '2.0.0');
  sh.rm(manifestA, manifestB);
  t.end();
});

test('bump (file not found)', async t => {
  await t.shouldReject(shell.bump('foo.json'), /no such file/i);
  t.end();
});

test('bump (invalid)', async t => {
  await t.shouldReject(shell.bump('test/resources/file1'), /unexpected token/i);
  t.end();
});
