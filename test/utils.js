import { EOL } from 'node:os';
import test from 'ava';
import mockStdIo from 'mock-stdio';
import stripAnsi from 'strip-ansi';
import { format, truncateLines, parseGitUrl, parseVersion, deepMerge } from '../lib/util.js';

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


test("deepMerge (case 1)", t => {
  const target = { a: 1, b: { c: 2, d: { e: 3 } } };
  const source1 = { b: { c: 4, d: { e: null, f: 5 } }, g: 6 };
  const source2 = { h: 7 };
  const expected = { a: 1, b: { c: 2, d: { e: 3, f: 5 } }, g: 6, h: 7 };
  const merged = deepMerge(target, source1, source2);
  t.deepEqual(merged, expected);
});
test("deepMerge (case 2)", t => {
  const target = { a: { b: { c: 1 } } };
  const source1 = { a: { b: { d: 2 } } };
  const expected = { a: { b: { c: 1, d: 2 } } };
  const merged = deepMerge(target, source1);
  t.deepEqual(merged, expected);
});
test("deepMerge (case 3)", t => {
  const target = { a: [1, 2], b: { c: [3, 4] } };
  const source1 = { a: [5, 6], b: { c: [7, 8] } };
  const expected = { a: [5, 6], b: { c: [7, 8] } };
  const merged = deepMerge(target, source1);
  t.deepEqual(merged, expected);
});
test("deepMerge (case 4)", t => {
  const target = { a: { b: { c: 1 } } };
  const source1 = { a: { b: { c: undefined, d: 2 } } };
  const expected = { a: { b: { c: 1, d: 2 } } };
  const merged = deepMerge(target, source1);
  t.deepEqual(merged, expected);
});
test("deepMerge (case 5)", t => {
  const target = { a: { b: { c: 1 } } };
  const source1 = undefined;
  const expected = { a: { b: { c: 1 } } };
  const merged = deepMerge(target, source1);
  t.deepEqual(merged, expected);
});
test("deepMerge (case 6)", t => {
  const target = { a: { b: { c: 1 } } };
  const source1 = null;
  const expected = { a: { b: { c: 1 } } };
  const merged = deepMerge(target, source1);
  t.deepEqual(merged, expected);
});