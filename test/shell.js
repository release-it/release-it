import test from 'tape';
import proxyquire from 'proxyquire';
import shell from 'shelljs';
import * as logMock from './mock/log';
import path from 'path';
import { readFile, readJSON } from './util/index';
import { config } from '../lib/config';

const { run, runTemplateCommand, pushd, popd, mkTmpDir, copy, bump } = proxyquire('../lib/shell', {
  './log': logMock
});

const dir = 'test/resources';
const pwd = process.cwd();

test('run', async t => {
  t.equal(await run('pwd'), pwd);
  t.equal(await run('!pwd'), pwd);
  t.end();
});

test('run (dry run)', async t => {
  config.options['dry-run'] = true;
  t.equal(await run('pwd'), undefined);
  t.equal(await run('pwd', { isReadOnly: true }), pwd);
  config.options['dry-run'] = false;
  t.equal(await run('pwd'), pwd);
  t.end();
});

test('runTemplateCommand', async t => {
  const run = cmd => runTemplateCommand(cmd, { verbose: false });
  t.notOk(await run(''));
  t.equal(await run('pwd'), pwd);
  t.equal(await run('!echo ${src.commitMessage}'), 'Release %s');
  t.equal(await run('printf "${src.tagAnnotation}" "1.0.0"'), 'Release 1.0.0');
  t.end();
});

test('pushd + popd', async t => {
  const outputPush = await pushd(dir);
  const [to, from] = outputPush.split(',');
  const diff = to.replace(from + '/', '');
  t.equal(diff, dir);
  const popOutput = await popd();
  const trail = popOutput.split(',');
  t.equal(trail.length, 1);
  t.end();
});

test('copy', async t => {
  shell.pushd(dir);
  shell.mkdir('tmp');
  await copy(['file*'], {}, 'tmp');
  t.equal(await readFile('file1'), await readFile('tmp/file1'));
  t.equal(await readFile('file2'), await readFile('tmp/file2'));
  shell.rm('-rf', 'tmp');
  shell.popd();
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
  await run(`rm ${manifestA} ${manifestB}`);
  t.end();
});

test('bump (file not found)', async t => {
  t.shouldReject(bump('foo.json'), /no such file/i);
  t.end();
});

test('bump (invalid)', async t => {
  t.shouldReject(bump('test/resources/file1'), /unexpected token/i);
  t.end();
});

test('mkTmpDir', async t => {
  shell.pushd(dir);
  const { path, cleanup } = await mkTmpDir('tmp');
  t.equal(path, 'tmp');
  t.ok(shell.ls().includes('tmp'));
  await cleanup();
  t.notOk(shell.ls().includes('tmp'));
  shell.popd();
  t.end();
});

test('mkTmpDir (dry run)', async t => {
  config.options['dry-run'] = true;
  shell.pushd(dir);
  const { path, cleanup } = await mkTmpDir();
  t.ok(/\.tmp-(\w{8})/.test(path));
  t.ok(shell.ls('-A').includes(path));
  await cleanup();
  t.notOk(shell.ls('-A').includes(path));
  shell.popd();
  t.end();
});
