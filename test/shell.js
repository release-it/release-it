const test = require('tape');
const sinon = require('sinon');
const sh = require('shelljs');
const mockStdIo = require('mock-stdio');
const path = require('path');
const { EOL } = require('os');
const { readFile, readJSON } = require('./util/index');
const { config } = require('../lib/config');
const { run, runTemplateCommand, pushd, popd, copy, bump } = require('../lib/shell');

const dir = 'test/resources';
const cwd = process.cwd();

test('run (shell.exec)', async t => {
  t.equal(await run('echo bar'), 'bar');
  t.end();
});

test('run (shelljs command)', async t => {
  const stub = sinon.spy(sh, 'pwd');
  await run('!pwd foo');
  t.equal(stub.callCount, 1);
  t.equal(stub.firstCall.args[0], 'foo');
  stub.restore();
  t.end();
});

test('run (dry-run/read-only)', async t => {
  const { 'dry-run': dryRun } = config.options;
  config.options['dry-run'] = true;
  {
    mockStdIo.start();
    const actual = await run('!pwd', { isReadOnly: true });
    const { stdout } = mockStdIo.end();
    t.equal(actual, cwd);
    t.ok(/\$ pwd/.test(stdout));
    t.notOk(/not executed in dry run/.test(stdout));
  }
  {
    mockStdIo.start();
    const actual = await run('!pwd', { isReadOnly: false });
    const { stdout } = mockStdIo.end();
    t.equal(actual, undefined);
    t.ok(/\$ pwd/.test(stdout));
    t.ok(/not executed in dry run/.test(stdout));
  }
  config.options['dry-run'] = dryRun;
  t.end();
});

test('run (verbose)', async t => {
  const { verbose } = config.options;
  config.options.verbose = true;
  mockStdIo.start();
  const actual = await run('echo foo');
  const { stdout } = mockStdIo.end();
  t.equal(stdout, `$ echo foo\nfoo${EOL}`);
  t.equal(actual, 'foo');
  config.options.verbose = verbose;
  t.end();
});

test('runTemplateCommand', async t => {
  const run = cmd => runTemplateCommand(cmd, { verbose: false });
  t.equal(await run(''), undefined);
  t.equal(await run('!pwd'), cwd);
  t.equal(await run('echo ${git.pushRepo}'), 'origin');
  t.equal(await run('echo -*- ${github.tokenRef} -*-'), '-*- GITHUB_TOKEN -*-');
  t.end();
});

test('pushd + popd', async t => {
  const outputPush = await pushd(dir);
  const [to, from] = outputPush.split(',');
  const diff = to
    .replace(from, '')
    .replace(/^[/|\\\\]/, '')
    .replace(/\\/g, '/');
  t.equal(diff, dir);
  const popOutput = await popd();
  const trail = popOutput.split(',');
  t.equal(trail.length, 1);
  t.end();
});

test('copy', async t => {
  sh.pushd('-q', dir);
  sh.mkdir('tmp');
  await copy(['file*'], {}, 'tmp');
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
  await bump(manifestA, '1.0.0');
  const pkg = await readJSON(manifestA);
  t.equal(pkg.version, '1.0.0');
  await bump([manifestA, manifestB], '2.0.0');
  const pkgA = await readJSON(manifestA);
  const pkgB = await readJSON(manifestB);
  t.equal(pkgA.version, '2.0.0');
  t.equal(pkgB.version, '2.0.0');
  sh.rm(manifestA, manifestB);
  t.end();
});

test('bump (file not found)', async t => {
  await t.shouldReject(bump('foo.json'), /no such file/i);
  t.end();
});

test('bump (invalid)', async t => {
  await t.shouldReject(bump('test/resources/file1'), /unexpected token/i);
  t.end();
});
