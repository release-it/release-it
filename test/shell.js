import test from 'tape';
import proxyquire from 'proxyquire';
import * as logMock from './mock/log';
import path from 'path';
import { readFile, readJSON } from './util/index';

const { run, pushd, popd, mkCleanDir, copy, bump } = proxyquire('../lib/shell', {
  './log': logMock
});

const dir = 'test/resources';

test('pushd + popd', async t => {
  const [to, from] = await pushd(dir);
  const diff = to.replace(from + '/', '');
  t.equal(diff, dir);
  const trail = await popd();
  t.equal(trail.length, 1);
  t.end();
});

test('mk + cp + run', async t => {
  await pushd(dir);
  await mkCleanDir('tmp');
  await copy(['file1', 'file2'], {}, 'tmp');
  await popd();
  t.equal(await readFile(`${dir}/file1`), await readFile(`${dir}/tmp/file1`));
  t.equal(await readFile(`${dir}/file2`), await readFile(`${dir}/tmp/file2`));
  await run(`rm -rf ${dir}/tmp`);
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
