import { EOL } from 'node:os';
import test from 'node:test';
import assert from 'node:assert/strict';
import { stripVTControlCharacters } from 'node:util';
import mockStdIo from 'mock-stdio';
import { format, truncateLines, parseGitUrl, parseVersion } from '../lib/util.js';

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
