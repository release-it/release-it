import { EOL } from 'node:os';
import test from 'node:test';
import assert from 'node:assert/strict';
import { stripVTControlCharacters } from 'node:util';
import mockStdIo from 'mock-stdio';
import { format, truncateLines, parseGitUrl, parseVersion, get } from '../lib/util.js';

test('format', () => {
  assert.equal(format('release v${version}', { version: '1.0.0' }), 'release v1.0.0');
  assert.equal(format('release v${version} (${name})', { version: '1.0.0', name: 'foo' }), 'release v1.0.0 (foo)');
  assert.equal(format('release v${version} (${name})', { version: '1.0.0', name: 'foo' }), 'release v1.0.0 (foo)');
});

test('format (throw)', () => {
  mockStdIo.start();
  assert.throws(() => format('release v${foo}', { version: '1.0.0' }), /foo is not defined/);
  const { stdout, stderr } = mockStdIo.end();
  assert.equal(stdout, '');
  assert.match(
    stripVTControlCharacters(stderr),
    /ERROR Unable to render template with context:\s+release v\${foo}\s+{"version":"1\.0\.0"}\s+ERROR ReferenceError: foo is not defined/
  );
});

test('truncateLines', () => {
  const input = `1${EOL}2${EOL}3${EOL}4${EOL}5${EOL}6`;
  assert.equal(truncateLines(input), input);
  assert.equal(truncateLines(input, 3), `1${EOL}2${EOL}3${EOL}...and 3 more`);
  assert.equal(truncateLines(input, 1, '...'), `1...`);
});

test('parseGitUrl', () => {
  assert.deepEqual(parseGitUrl('https://github.com/webpro/release-it.git'), {
    host: 'github.com',
    owner: 'webpro',
    project: 'release-it',
    protocol: 'https',
    remote: 'https://github.com/webpro/release-it.git',
    repository: 'webpro/release-it'
  });

  assert.deepEqual(parseGitUrl('git@gitlab.com:org/sub-group/repo-in-sub-group.git'), {
    host: 'gitlab.com',
    owner: 'org/sub-group',
    project: 'repo-in-sub-group',
    protocol: 'ssh',
    remote: 'git@gitlab.com:org/sub-group/repo-in-sub-group.git',
    repository: 'org/sub-group/repo-in-sub-group'
  });

  assert.deepEqual(parseGitUrl('git@github.com:org/example.com.git'), {
    host: 'github.com',
    owner: 'org',
    project: 'example.com',
    protocol: 'ssh',
    remote: 'git@github.com:org/example.com.git',
    repository: 'org/example.com'
  });

  assert.deepEqual(parseGitUrl('file://Users/john/doe/owner/project'), {
    host: 'users',
    owner: 'owner',
    project: 'project',
    protocol: 'file',
    remote: 'file://users/john/doe/owner/project',
    repository: 'owner/project'
  });

  assert.deepEqual(parseGitUrl('/Users/john/doe/owner/project'), {
    host: 'users',
    owner: 'owner',
    project: 'project',
    protocol: 'file',
    remote: 'file://users/john/doe/owner/project',
    repository: 'owner/project'
  });

  assert.deepEqual(parseGitUrl('C:\\\\Users\\john\\doe\\owner\\project'), {
    host: 'users',
    owner: 'owner',
    project: 'project',
    protocol: 'file',
    remote: 'file://users/john/doe/owner/project',
    repository: 'owner/project'
  });
});

for (const [remote, host, protocol] of [
  ['ssh://git@ssh.github.com:443/owner/repo.git', 'github.com', 'ssh'],
  ['ssh://git@ssh.github.com/owner/repo.git', 'github.com', 'ssh'],
  ['git@ssh.github.com:owner/repo.git', 'github.com', 'ssh'],
  ['git+ssh://git@ssh.github.com:443/owner/repo.git', 'github.com', 'ssh'],
  ['https://ssh.github.com/owner/repo.git', 'github.com', 'https'],
  ['ssh://git@ssh.github.com:22/owner/repo.git', 'github.com', 'ssh'],
  ['ssh://git@ssh.github.com:443/owner/repo', 'github.com', 'ssh'],
  ['ssh://git@github.com:443/owner/repo.git', 'github.com', 'ssh'],
  ['ssh://git@github.com/owner/repo.git', 'github.com', 'ssh'],
  ['git@github.com:owner/repo.git', 'github.com', 'ssh'],
  ['git+ssh://git@github.com:443/owner/repo.git', 'github.com', 'ssh'],
  ['https://github.com/owner/repo.git', 'github.com', 'https'],
  ['git://github.com/owner/repo.git', 'github.com', 'git'],
  ['ssh://git@ghe.example.org:443/owner/repo.git', 'ghe.example.org', 'ssh'],
  ['git@ghe.example.org:owner/repo.git', 'ghe.example.org', 'ssh'],
  ['https://ghe.example.org/owner/repo.git', 'ghe.example.org', 'https'],
  ['git@ssh.ghe.example.org:owner/repo.git', 'ssh.ghe.example.org', 'ssh'],
  ['ssh://git@ssh.github.com.evil.example:443/owner/repo.git', 'ssh.github.com.evil.example', 'ssh'],
  ['git@notssh.github.com:owner/repo.git', 'notssh.github.com', 'ssh'],
  ['git@altssh.gitlab.com:owner/repo.git', 'altssh.gitlab.com', 'ssh'],
  ['git@altssh.bitbucket.org:owner/repo.git', 'altssh.bitbucket.org', 'ssh'],
  ['ssh://git@SSH.GITHUB.COM:443/owner/repo.git', 'SSH.GITHUB.COM', 'ssh'],
  ['ssh://git@GITHUB.COM:443/owner/repo.git', 'GITHUB.COM', 'ssh'],
  ['file://users/john/doe/owner/repo', 'users', 'file']
]) {
  test(`parseGitUrl (${remote})`, () => {
    assert.deepEqual(parseGitUrl(remote), {
      host,
      owner: 'owner',
      project: 'repo',
      protocol,
      remote,
      repository: 'owner/repo'
    });
  });
}

test('parseVersion', () => {
  assert.deepEqual(parseVersion(), { version: undefined, isPreRelease: false, preReleaseId: null });
  assert.deepEqual(parseVersion(0), { version: '0.0.0', isPreRelease: false, preReleaseId: null });
  assert.deepEqual(parseVersion(1), { version: '1.0.0', isPreRelease: false, preReleaseId: null });
  assert.deepEqual(parseVersion('1'), { version: '1.0.0', isPreRelease: false, preReleaseId: null });
  assert.deepEqual(parseVersion('1.0'), { version: '1.0.0', isPreRelease: false, preReleaseId: null });
  assert.deepEqual(parseVersion('1.0.0'), { version: '1.0.0', isPreRelease: false, preReleaseId: null });
  assert.deepEqual(parseVersion('1.0.0-0'), { version: '1.0.0-0', isPreRelease: true, preReleaseId: null });
  assert.deepEqual(parseVersion('1.0.0-next.1'), { version: '1.0.0-next.1', isPreRelease: true, preReleaseId: 'next' });
  assert.deepEqual(parseVersion('21.04.1'), { version: '21.04.1', isPreRelease: false, preReleaseId: null });
});

test('parseVersion preserves valid version strings', () => {
  assert.deepEqual(parseVersion('v1.2.3+build.4'), {
    version: 'v1.2.3+build.4',
    isPreRelease: false,
    preReleaseId: null
  });
  assert.deepEqual(parseVersion('1.2.3-beta.1+build.4'), {
    version: '1.2.3-beta.1+build.4',
    isPreRelease: true,
    preReleaseId: 'beta'
  });
});

test('parseVersion preserves inputs that cannot be coerced', () => {
  assert.deepEqual(parseVersion(null), { version: null, isPreRelease: false, preReleaseId: null });
  assert.deepEqual(parseVersion(''), { version: '', isPreRelease: false, preReleaseId: null });
  assert.deepEqual(parseVersion('invalid'), { version: 'invalid', isPreRelease: false, preReleaseId: null });
});

const sample = {
  root: {
    level1: {
      level2: {
        value: 'nested'
      },
      array: [
        { id: 1, data: 'first' },
        { id: 2, data: 'second' }
      ],
      'key.with.dot': {
        special: true
      }
    },
    mixed: [{ deep: { value: 100 } }, { deep: { value: 200 } }]
  }
};

test('get: accesses a simple nested property', () => {
  assert.equal(get(sample, 'root.level1.level2.value'), 'nested');
});

test('get: accesses array elements by index', () => {
  assert.equal(get(sample, 'root.level1.array[0].data'), 'first');
  assert.equal(get(sample, 'root.level1.array[1].id'), 2);
});

test('get: accesses keys with dots using bracket notation', () => {
  assert.equal(get(sample, 'root.level1["key.with.dot"].special'), true);
});

test('get: navigates mixed objects and arrays', () => {
  assert.equal(get(sample, 'root.mixed[0].deep.value'), 100);
  assert.equal(get(sample, 'root.mixed[1].deep.value'), 200);
});

test('get: returns default value for non-existent properties', () => {
  assert.equal(get(sample, 'root.level1.unknown', 'default'), 'default');
  assert.equal(get(sample, 'root.level1.array[10].id', null), null);
});

test('get: handles empty path and null/undefined objects', () => {
  assert.equal(get(sample, '', 'default'), 'default');
  assert.equal(get(null, 'any.path', 'default'), 'default');
  assert.equal(get(undefined, 'any.path', 'default'), 'default');
});
