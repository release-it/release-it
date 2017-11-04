import test from 'tape';
import proxyquire from 'proxyquire';
import { getLatestTag } from '../lib/git';

const mocks = {
  './git': {
    getLatestTag
  }
};

const { isValidVersion, format, template, parseVersion, isSameRepo, truncateLines } = proxyquire('../lib/util', mocks);

test('isValidVersion', t => {
  t.equal(isValidVersion('1.0.0'), true);
  t.equal(isValidVersion(1.0), false);
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

test('parseVersion (bump to provided version)', async t => {
  mocks['./git'].getLatestTag = () => '1.0.0';
  t.deepEqual(await parseVersion({ increment: '1.2.3' }), {
    latestVersion: '1.0.0',
    version: '1.2.3'
  });
  t.deepEqual(await parseVersion({ increment: '0.8.0' }), {
    latestVersion: '1.0.0',
    version: false
  });
  t.end();
});

test('truncateLines', t => {
  const input = '1\n2\n3\n4\n5\n6';
  t.equal(truncateLines(input), input);
  t.equal(truncateLines(input, 3), '1\n2\n3\n...and 3 more');
  t.end();
});
