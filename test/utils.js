import { EOL } from 'node:os';
import test from 'ava';
import mockStdIo from 'mock-stdio';
import stripAnsi from 'strip-ansi';
import { format, truncateLines, parseGitUrl, parseVersion, merge } from '../lib/util.js';

test('format', t => {
  t.is(format('release v${version}', { version: '1.0.0' }), 'release v1.0.0');
  t.is(format('release v${version} (${name})', { version: '1.0.0', name: 'foo' }), 'release v1.0.0 (foo)');
  t.is(format('release v${version} (${name})', { version: '1.0.0', name: 'foo' }), 'release v1.0.0 (foo)');
});

test('format (throw)', t => {
  mockStdIo.start();
  t.throws(() => format('release v${foo}', { version: '1.0.0' }), { message: /foo is not defined/ });
  const { stdout, stderr } = mockStdIo.end();
  t.is(stdout, '');
  t.regex(
    stripAnsi(stderr),
    /ERROR Unable to render template with context:\s+release v\${foo}\s+{"version":"1\.0\.0"}\s+ERROR ReferenceError: foo is not defined/
  );
});

test('truncateLines', t => {
  const input = `1${EOL}2${EOL}3${EOL}4${EOL}5${EOL}6`;
  t.is(truncateLines(input), input);
  t.is(truncateLines(input, 3), `1${EOL}2${EOL}3${EOL}...and 3 more`);
  t.is(truncateLines(input, 1, '...'), `1...`);
});

test('parseGitUrl', t => {
  t.deepEqual(parseGitUrl('https://github.com/webpro/release-it.git'), {
    host: 'github.com',
    owner: 'webpro',
    project: 'release-it',
    protocol: 'https',
    remote: 'https://github.com/webpro/release-it.git',
    repository: 'webpro/release-it'
  });

  t.deepEqual(parseGitUrl('git@gitlab.com:org/sub-group/repo-in-sub-group.git'), {
    host: 'gitlab.com',
    owner: 'org/sub-group',
    project: 'repo-in-sub-group',
    protocol: 'ssh',
    remote: 'git@gitlab.com:org/sub-group/repo-in-sub-group.git',
    repository: 'org/sub-group/repo-in-sub-group'
  });

  t.deepEqual(parseGitUrl('git@github.com:org/example.com.git'), {
    host: 'github.com',
    owner: 'org',
    project: 'example.com',
    protocol: 'ssh',
    remote: 'git@github.com:org/example.com.git',
    repository: 'org/example.com'
  });

  t.deepEqual(parseGitUrl('file://Users/john/doe/owner/project'), {
    host: 'users',
    owner: 'owner',
    project: 'project',
    protocol: 'file',
    remote: 'file://users/john/doe/owner/project',
    repository: 'owner/project'
  });

  t.deepEqual(parseGitUrl('/Users/john/doe/owner/project'), {
    host: 'users',
    owner: 'owner',
    project: 'project',
    protocol: 'file',
    remote: 'file://users/john/doe/owner/project',
    repository: 'owner/project'
  });

  t.deepEqual(parseGitUrl('C:\\\\Users\\john\\doe\\owner\\project'), {
    host: 'users',
    owner: 'owner',
    project: 'project',
    protocol: 'file',
    remote: 'file://users/john/doe/owner/project',
    repository: 'owner/project'
  });
});

test('parseVersion', t => {
  t.deepEqual(parseVersion(), { version: undefined, isPreRelease: false, preReleaseId: null });
  t.deepEqual(parseVersion(0), { version: '0.0.0', isPreRelease: false, preReleaseId: null });
  t.deepEqual(parseVersion(1), { version: '1.0.0', isPreRelease: false, preReleaseId: null });
  t.deepEqual(parseVersion('1'), { version: '1.0.0', isPreRelease: false, preReleaseId: null });
  t.deepEqual(parseVersion('1.0'), { version: '1.0.0', isPreRelease: false, preReleaseId: null });
  t.deepEqual(parseVersion('1.0.0'), { version: '1.0.0', isPreRelease: false, preReleaseId: null });
  t.deepEqual(parseVersion('1.0.0-0'), { version: '1.0.0-0', isPreRelease: true, preReleaseId: null });
  t.deepEqual(parseVersion('1.0.0-next.1'), { version: '1.0.0-next.1', isPreRelease: true, preReleaseId: 'next' });
  t.deepEqual(parseVersion('21.04.1'), { version: '21.04.1', isPreRelease: false, preReleaseId: null });
});

// Basic merging
test('merges two objects', t => {
  const target = { a: 1, b: 2 };
  const source = { b: 3, c: 4 };
  t.deepEqual(merge(target, source), { a: 1, b: 3, c: 4 });
});

// Deep merging
test('merges nested objects', t => {
  const target = { a: { x: 1 } };
  const source = { a: { y: 2 } };
  t.deepEqual(merge(target, source), { a: { x: 1, y: 2 } });
});

// Merging arrays
test('concatenates arrays', t => {
  const target = { a: [1, 2] };
  const source = { a: [3, 4] };
  t.deepEqual(merge(target, source), { a: [1, 2, 3, 4] });
});

// Prevent prototype pollution
test('does not allow prototype pollution', t => {
  const target = {};
  const source = JSON.parse('{"__proto__": {"polluted": true} }');
  merge(target, source);
  t.falsy({}.polluted);
});

// Undefined values should not overwrite existing values
test('ignores undefined values', t => {
  const target = { a: 1 };
  const source = { a: undefined, b: 2 };
  t.deepEqual(merge(target, source), { a: 1, b: 2 });
});

// Handles null and invalid inputs
test('returns target when sources are null or invalid', t => {
  const target = { a: 1 };
  t.deepEqual(merge(target, null), { a: 1 });
  t.deepEqual(merge(target, undefined), { a: 1 });
  t.deepEqual(merge(target, 42), { a: 1 });
  t.deepEqual(merge(target, 'string'), { a: 1 });
});

// Handles empty sources
test('returns target when no sources are provided', t => {
  const target = { a: 1 };
  t.deepEqual(merge(target), { a: 1 });
});

// Deep merging with multiple sources
test('merges multiple sources correctly', t => {
  const target = { a: 1, b: { x: 10 } };
  const source1 = { b: { y: 20 }, c: 3 };
  const source2 = { d: 4, b: { z: 30 } };
  t.deepEqual(merge(target, source1, source2), { a: 1, b: { x: 10, y: 20, z: 30 }, c: 3, d: 4 });
});
