import test from 'tape';
import proxyquire from 'proxyquire';
import { getLatestTag } from '../lib/git';

const mocks = {
  './git': {
    getLatestTag
  }
};

const { isValidVersion, inc, format, template, parseVersion, isSameRepo } = proxyquire('../lib/util', mocks);

test('isValidVersion', t => {
  t.equal(isValidVersion('1.0.0'), true);
  t.equal(isValidVersion(1.0), false);
  t.end();
});

test('inc', t => {
  t.equal(inc('1.0.0'), '1.0.1');
  t.end();
});

test('inc', t => {
  t.equal(inc('1.0.0', 'patch', 'beta'), '1.0.1');
  t.equal(inc('1.0.0', 'minor', 'beta'), '1.1.0');
  t.equal(inc('1.0.0', 'major', 'beta'), '2.0.0');
  t.equal(inc('1.0.0', 'prepatch', 'beta'), '1.0.1-beta.0');
  t.equal(inc('1.0.0', 'preminor', 'beta'), '1.1.0-beta.0');
  t.equal(inc('1.0.0', 'premajor', 'beta'), '2.0.0-beta.0');
  t.equal(inc('1.0.0', 'prerelease', 'beta'), '1.0.1-beta.0');
  t.equal(inc('1.0.0', 'pre', 'beta'), '1.0.0-beta.0');
  t.equal(inc('1.0.0-alpha.0', 'prerelease'), '1.0.0-alpha.1');
  t.equal(inc('1.0.0-alpha.0', 'prerelease', 'alpha'), '1.0.0-alpha.1');
  t.equal(inc('1.0.0-alpha.0', 'prerelease', 'alpha'), '1.0.0-alpha.1');
  t.equal(inc('1.0.0-alpha.0', 'prerelease', 'beta'), '1.0.0-beta.0');
  t.equal(inc('1.0.0', 'pre', 'sha'), '1.0.0-sha.0');
  t.equal(inc('1.0.0', 'prerelease', 'sha'), '1.0.1-sha.0');
  t.equal(inc('2.0.0-beta.0', 'major'), '2.0.0');
  t.equal(inc('2.0.0-beta.0'), '2.0.0');
  t.end();
});

test('format', t => {
  t.equal(format('release v%s', '1.0.0'), 'release v1.0.0');
  t.equal(format('release v%s (%s)', '1.0.0', 'name'), 'release v1.0.0 (name)');
  t.end();
});

test('template', t => {
  t.equal(template('release v${version}', { version: '1.0.0' }), 'release v1.0.0');
  t.equal(template('release v${version} (${name})', { version: '1.0.0', name: 'foo' }), 'release v1.0.0 (foo)');
  t.end();
});

test('isSameRepo', t => {
  const repoA = {
    remote: 'https://github.com/webpro/release-it.git',
    protocol: 'https',
    host: 'github.com',
    repository: 'webpro/release-it',
    owner: 'webpro',
    project: 'release-it-test'
  };
  const repoB = Object.assign({}, repoA, {
    remote: 'https://github.com/webpro/release-it.git#dist'
  });
  t.ok(isSameRepo(repoA, repoB));
  t.end();
});

test('parseVersion', async t => {
  mocks['./git'].getLatestTag = () => 'rc-1.2.3.4';
  t.deepEqual(await parseVersion({ increment: 'patch', npm: { version: '0.0.1' } }), {
    latestVersion: '0.0.1',
    version: '0.0.2'
  });
  mocks['./git'].getLatestTag = () => '2.2.0';
  t.deepEqual(await parseVersion({ increment: 'patch', npm: { version: '0.0.1' } }), {
    latestVersion: '2.2.0',
    version: '2.2.1'
  });
  t.end();
});
