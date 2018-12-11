const test = require('tape');
const shell = require('shelljs');
const mockStdIo = require('mock-stdio');
const path = require('path');
const { EOL } = require('os');
const { readFile, readJSON } = require('./util/index');
const { config } = require('../lib/config');
const { run, runTemplateCommand, pushd, popd, mkTmpDir, copy, bump } = require('../lib/shell');

const dir = 'test/resources';
const pwd = process.cwd();

test('run (shell.exec)', async t => {
  t.equal(await run('echo bar'), 'bar');
  t.end();
});

test('run (shelljs command)', async t => {
  mockStdIo.start();
  await run('!echo foo');
  const { stdout } = mockStdIo.end();
  t.equal(stdout, 'foo\n');
  t.end();
});

test('run (dry run)', async t => {
  const { 'dry-run': dryRun } = config.options;
  mockStdIo.start();
  config.options['dry-run'] = true;
  const pwd = await run('!pwd');
  const { stdout } = mockStdIo.end();
  t.ok(/not executed in dry run/.test(stdout));
  t.equal(pwd, undefined);
  config.options['dry-run'] = dryRun;
  t.end();
});

test('run (verbose)', async t => {
  const { verbose } = config.options;
  mockStdIo.start();
  config.options.verbose = true;
  const actual = await run('echo foo');
  const { stdout } = mockStdIo.end();
  t.equal(stdout, `$ echo foo\nfoo${EOL}`);
  t.equal(actual, 'foo');
  config.options.verbose = verbose;
  t.end();
});

test.skip('run (read-only command)', async t => {
  t.equal(await run('!pwd', { isReadOnly: true }), pwd);
  t.end();
});

test('runTemplateCommand', async t => {
  const run = cmd => runTemplateCommand(cmd, { verbose: false });
  t.notOk(await run(''));
  t.equal(await run('!pwd'), pwd);
  t.equal(await run('echo ${src.pushRepo}'), 'origin');
  t.equal(await run('echo -*- ${github.tokenRef} -*-'), '-*- GITHUB_TOKEN -*-');
  t.end();
});

test('pushd + popd', async t => {
  const outputPush = await pushd(dir);
  const [to, from] = outputPush.split(',');
  const diff = to
    .replace(from, '')
    .replace(/^[\/|\\\\]/, '')
    .replace(/\\/g, '/');
  t.equal(diff, dir);
  const popOutput = await popd();
  const trail = popOutput.split(',');
  t.equal(trail.length, 1);
  t.end();
});

test('copy', async t => {
  shell.pushd('-q', dir);
  shell.mkdir('tmp');
  await copy(['file*'], {}, 'tmp');
  t.equal(await readFile('file1'), await readFile('tmp/file1'));
  t.equal(await readFile('file2'), await readFile('tmp/file2'));
  shell.rm('-rf', 'tmp');
  shell.popd('-q');
  t.end();
});

test('bump', async t => {
  const target = path.resolve(dir);
  const manifestA = path.join(target, 'package.json');
  const manifestB = path.join(target, 'lockfile.json');
  await copy('package.json', {}, target);
  await copy('package.json', { rename: () => 'lockfile.json' }, target);
  await bump(manifestA, '1.0.0');
  const pkg = await readJSON(manifestA);
  t.equal(pkg.version, '1.0.0');
  await bump([manifestA, manifestB], '2.0.0');
  const pkgA = await readJSON(manifestA);
  const pkgB = await readJSON(manifestB);
  t.equal(pkgA.version, '2.0.0');
  t.equal(pkgB.version, '2.0.0');
  await run(`!rm ${manifestA} ${manifestB}`);
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

test('mkTmpDir', async t => {
  shell.pushd('-q', dir);
  const { path, cleanup } = await mkTmpDir('tmp');
  t.equal(path, 'tmp');
  t.ok(~shell.ls().indexOf('tmp'));
  await cleanup();
  t.notOk(~shell.ls().indexOf('tmp'));
  shell.popd('-q');
  t.end();
});

test('mkTmpDir (dry run)', async t => {
  const { 'dry-run': dryRun } = config.options;
  config.options['dry-run'] = true;
  shell.pushd('-q', dir);
  const { path, cleanup } = await mkTmpDir();
  t.ok(/\.tmp-(\w{8})/.test(path));
  t.ok(~shell.ls('-A').indexOf(path));
  await cleanup();
  t.notOk(~shell.ls('-A').indexOf(path));
  shell.popd('-q');
  config.options['dry-run'] = dryRun;
  t.end();
});
