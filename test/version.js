const test = require('tape');
const proxyquire = require('proxyquire');
const shell = require('shelljs');
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

test('parseVersion (tag)', async t => {
  const { parse } = getMock({ getLatestTag: () => '2.2.0' });
  t.deepEqual(await parse({ increment: 'patch', npm: { version: '0.0.1' } }), {
    latestVersion: '2.2.0',
    version: '2.2.1'
  });
  t.end();
});

test('parseVersion (package.json#version fallback)', async t => {
  const { parse } = getMock({ getLatestTag: () => null });
  t.deepEqual(await parse({ increment: 'patch', npm: { version: '0.6.3' } }), {
    latestVersion: '0.6.3',
    version: '0.6.4'
  });
  t.end();
});

test('parseVersion (bump to provided version)', async t => {
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

test('parseVersion (no bump)', async t => {
  const { parse } = getMock({ getLatestTag: () => '1.0.0' });
  t.deepEqual(await parse({ increment: false }), {
    latestVersion: '1.0.0',
    version: '1.0.0'
  });
  t.end();
});

test('parseVersion (patch pre-release)', async t => {
  const { parse } = getMock({ getLatestTag: () => '0.2.0' });
  t.deepEqual(await parse({ increment: 'prepatch', preReleaseId: 'alpha' }), {
    latestVersion: '0.2.0',
    version: '0.2.1-alpha.0'
  });
  t.end();
});

test('parseVersion (patch pre-release with --preRelease=alpha)', async t => {
  const { parse } = getMock({ getLatestTag: () => '0.2.1' });
  t.deepEqual(await parse({ increment: 'prerelease', preReleaseId: 'alpha' }), {
    latestVersion: '0.2.1',
    version: '0.2.2-alpha.0'
  });
  t.end();
});

test('parseVersion (prepatch follow-up)', async t => {
  const { parse } = getMock({ getLatestTag: () => '0.2.1-alpha.0' });
  t.deepEqual(await parse({ increment: 'prerelease' }), {
    latestVersion: '0.2.1-alpha.0',
    version: '0.2.1-alpha.1'
  });
  t.end();
});

test('parseVersion (non-numeric prepatch follow-up)', async t => {
  const { parse } = getMock({ getLatestTag: () => '0.2.1-alpha' });
  t.deepEqual(await parse({ increment: 'prerelease' }), {
    latestVersion: '0.2.1-alpha',
    version: '0.2.1-alpha.0'
  });
  t.end();
});

test('parseVersion (patch release after pre-release)', async t => {
  const { parse } = getMock({ getLatestTag: () => '0.2.1-alpha.1' });
  t.deepEqual(await parse({ increment: 'patch' }), {
    latestVersion: '0.2.1-alpha.1',
    version: '0.2.1'
  });
  t.end();
});

test('parseVersion (recommended conventional bump)', async t => {
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
