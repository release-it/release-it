const test = require('tape');
const sinon = require('sinon');
const sh = require('shelljs');
const mockStdIo = require('mock-stdio');
const path = require('path');
const uuid = require('uuid/v4');
const { EOL } = require('os');
const { readFile, readJSON } = require('./util/index');
const Shell = require('../lib/shell');
const Log = require('../lib/log');

const cwd = process.cwd();

const sandbox = sinon.createSandbox();
const log = sandbox.createStubInstance(Log);
const shell = new Shell({ log });

test('run (shell.exec)', async t => {
  t.equal(await shell.run('echo bar'), 'bar');
  sandbox.resetHistory();
  t.end();
});

test('run (shelljs command)', async t => {
  const stub = sinon.spy(sh, 'pwd');
  await shell.run('!pwd foo');
  t.equal(stub.callCount, 1);
  t.equal(stub.firstCall.args[0], 'foo');
  stub.restore();
  sandbox.resetHistory();
  t.end();
});

test('run (dry-run/read-only)', async t => {
  const shell = new Shell({ isDryRun: true, log });
  {
    const actual = await shell.run('!pwd');
    t.equal(actual, cwd);
    t.equal(log.exec.firstCall.args[0], 'pwd');
    t.equal(log.dry.callCount, 0);
  }
  {
    const actual = await shell.run('!pwd', Shell.writes);
    t.equal(log.exec.secondCall.args[0], 'pwd');
    t.equal(log.dry.callCount, 1);
    t.equal(actual, undefined);
  }
  sandbox.resetHistory();
  t.end();
});

test('run (verbose)', async t => {
  const shell = new Shell({ isVerbose: true, log });
  mockStdIo.start();
  const actual = await shell.run('echo foo');
  const { stdout } = mockStdIo.end();
  t.equal(log.exec.firstCall.args[0], 'echo foo');
  t.equal(stdout, `foo${EOL}`);
  t.equal(actual, 'foo');
  sandbox.resetHistory();
  t.end();
});

test('runTemplateCommand', async t => {
  const run = cmd => shell.runTemplateCommand(cmd, { verbose: false });
  t.equal(await run(''), undefined);
  t.equal(await run('!pwd'), cwd);
  t.equal(await run('echo ${git.pushRepo}'), 'origin');
  t.equal(await run('echo -*- ${github.tokenRef} -*-'), '-*- GITHUB_TOKEN -*-');
  sandbox.resetHistory();
  t.end();
});

test('pushd + popd', async t => {
  sh.dirs('-cq');
  const dir = 'test/resources';
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
  sandbox.resetHistory();
  t.end();
});

test('copy', async t => {
  const source = path.resolve(cwd, 'test/resources');
  const target = path.resolve(cwd, `tmp/${uuid()}`);
  sh.mkdir('-p', target);
  await shell.copy(['file*'], target, { cwd: source });
  t.equal(await readFile(`${source}/file1`), await readFile(`${target}/file1`));
  t.equal(await readFile(`${source}/file2`), await readFile(`${target}/file2`));
  sandbox.resetHistory();
  t.end();
});

test('bump', async t => {
  const target = path.resolve(cwd, `tmp/${uuid()}`);
  sh.mkdir('-p', target);
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
  sandbox.resetHistory();
  t.end();
});

test('bump (file not found)', async t => {
  await shell.bump('foo.json');
  t.equal(log.warn.firstCall.args[0], 'Could not bump foo.json');
  sandbox.resetHistory();
  t.end();
});

test('bump (invalid)', async t => {
  await shell.bump('test/resources/file1');
  t.equal(log.warn.firstCall.args[0], 'Could not bump test/resources/file1');
  sandbox.resetHistory();
  t.end();
});

test('bump (none)', async t => {
  await shell.bump(false);
  await shell.bump(null);
  await shell.bump([]);
  t.equal(log.warn.callCount, 0);
  sandbox.resetHistory();
  t.end();
});
