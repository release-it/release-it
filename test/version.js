const test = require('tape');
const proxyquire = require('proxyquire');
const shell = require('shelljs');
const mockStdIo = require('mock-stdio');
const { run } = require('../lib/shell');
const { isValid } = require('../lib/version');

const getMock = git =>
  proxyquire('../lib/version', {
    './git': git
  });

test('isValidVersion', t => {
  t.equal(isValid('1.0.0'), true);
  t.equal(isValid(1.0), false);
  t.end();
});

test('parse (tag)', async t => {
  const { parse } = getMock({ getLatestTag: () => '2.2.0' });
  mockStdIo.start();
  t.deepEqual(await parse({ increment: 'patch', npm: { version: '0.0.1' } }), {
    latestVersion: '2.2.0',
    version: '2.2.1'
  });
  const { stdout } = mockStdIo.end();
  t.ok(/Latest Git tag \(2\.2\.0\) doesn't match package\.json#version \(0\.0\.1\)/.test(stdout));
  t.end();
});

test('parse (package.json#version fallback)', async t => {
  const { parse } = getMock({ getLatestTag: () => null });
  t.deepEqual(await parse({ increment: 'patch', npm: { version: '0.6.3' } }), {
    latestVersion: '0.6.3',
    version: '0.6.4'
  });
  t.end();
});

test('parse (bump to provided version)', async t => {
  const { parse } = getMock({ getLatestTag: () => '1.0.0' });
  t.deepEqual(await parse({ increment: '1.2.3' }), {
    latestVersion: '1.0.0',
    version: '1.2.3'
  });
  t.deepEqual(await parse({ increment: '0.8.0' }), {
    latestVersion: '1.0.0',
    version: null
  });
  t.end();
});

test('parse (no bump)', async t => {
  const { parse } = getMock({ getLatestTag: () => '1.0.0' });
  t.deepEqual(await parse({ increment: false }), {
    latestVersion: '1.0.0',
    version: '1.0.0'
  });
  t.end();
});

test('parse (patch pre-release)', async t => {
  const { parse } = getMock({ getLatestTag: () => '0.2.0' });
  t.deepEqual(await parse({ increment: 'prepatch', preReleaseId: 'alpha' }), {
    latestVersion: '0.2.0',
    version: '0.2.1-alpha.0'
  });
  t.end();
});

test('parse (patch pre-release with --preRelease=alpha)', async t => {
  const { parse } = getMock({ getLatestTag: () => '0.2.1' });
  t.deepEqual(await parse({ increment: 'prerelease', preReleaseId: 'alpha' }), {
    latestVersion: '0.2.1',
    version: '0.2.2-alpha.0'
  });
  t.end();
});

test('parse (prepatch follow-up)', async t => {
  const { parse } = getMock({ getLatestTag: () => '0.2.1-alpha.0' });
  t.deepEqual(await parse({ increment: 'prerelease' }), {
    latestVersion: '0.2.1-alpha.0',
    version: '0.2.1-alpha.1'
  });
  t.end();
});

test('parse (non-numeric prepatch follow-up)', async t => {
  const { parse } = getMock({ getLatestTag: () => '0.2.1-alpha' });
  t.deepEqual(await parse({ increment: 'prerelease' }), {
    latestVersion: '0.2.1-alpha',
    version: '0.2.1-alpha.0'
  });
  t.end();
});

test('parse (patch release after pre-release)', async t => {
  const { parse } = getMock({ getLatestTag: () => '0.2.1-alpha.1' });
  t.deepEqual(await parse({ increment: 'patch' }), {
    latestVersion: '0.2.1-alpha.1',
    version: '0.2.1'
  });
  t.end();
});

test('parse (recommended conventional bump)', async t => {
  const { parse } = getMock({ getLatestTag: () => '1.0.0' });

  const tmp = 'test/resources/tmp';
  shell.mkdir(tmp);
  shell.pushd('-q', tmp);
  await run('git init');
  await run('echo line >> file && git add file && git commit -m "fix(thing): repair that thing"');
  await run(`git tag 1.0.0`);
  await run('echo line >> file && git add file && git commit -m "feat(foo): extend the foo"');
  await run('echo line >> file && git add file && git commit -m "feat(bar): more bar"');

  t.deepEqual(await parse({ increment: 'conventional:angular' }), {
    latestVersion: '1.0.0',
    version: '1.1.0'
  });

  shell.popd('-q');
  shell.rm('-rf', tmp);
  t.end();
});

test('parse (recommended conventional bump w/ pre-release)', async t => {
  const { parse } = getMock({ getLatestTag: () => '1.0.0' });

  const tmp = 'test/resources/tmp';
  shell.mkdir(tmp);
  shell.pushd('-q', tmp);
  await run('git init');
  await run('echo line >> file && git add file && git commit -m "fix(thing): repair that thing"');
  await run(`git tag 1.0.0`);
  await run('echo line >> file && git add file && git commit -m "feat(foo): extend the foo"');
  await run('echo line >> file && git add file && git commit -m "feat(bar): more bar"');

  t.deepEqual(await parse({ increment: 'conventional:angular', preReleaseId: 'canary' }), {
    latestVersion: '1.0.0',
    version: '1.1.0-canary.0'
  });

  shell.popd('-q');
  shell.rm('-rf', tmp);
  t.end();
});

test('parse (recommended conventional bump w/ pre-release continuation)', async t => {
  const { parse } = getMock({ getLatestTag: () => '1.0.0-canary.1' });

  const tmp = 'test/resources/tmp';
  shell.mkdir(tmp);
  shell.pushd('-q', tmp);
  await run('git init');
  await run('echo line >> file && git add file && git commit -m "fix(thing): repair that thing"');
  await run(`git tag 1.0.0`);
  await run('echo line >> file && git add file && git commit -m "feat(foo): extend the foo"');
  await run('echo line >> file && git add file && git commit -m "feat(bar): more bar"');

  t.deepEqual(await parse({ increment: 'conventional:angular', preReleaseId: true }), {
    latestVersion: '1.0.0-canary.1',
    version: '1.0.0-canary.2'
  });

  shell.popd('-q');
  shell.rm('-rf', tmp);
  t.end();
});

test('parse (invalid tag)', async t => {
  const { parse } = getMock({ getLatestTag: () => 'a.b.c' });
  mockStdIo.start();
  t.deepEqual(await parse({ increment: 'patch', npm: { version: '0.0.1' } }), {
    latestVersion: '0.0.1',
    version: '0.0.2'
  });
  const { stdout } = mockStdIo.end();
  t.ok(/Latest Git tag \(a\.b\.c\) is not a valid semver version/.test(stdout));
  t.end();
});

test('parse (invalid npm version)', async t => {
  const { parse } = getMock({ getLatestTag: () => '2.2.0' });
  mockStdIo.start();
  t.deepEqual(await parse({ increment: 'minor', npm: { version: '1.2' } }), {
    latestVersion: '2.2.0',
    version: '2.3.0'
  });
  const { stdout } = mockStdIo.end();
  t.ok(/The npm version \(1\.2\) is not a valid semver version/.test(stdout));
  t.end();
});
