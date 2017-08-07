import test from 'tape';
import { isValidVersion, inc, format, template, isSameRepo } from '../lib/util';

test('isValidVersion', t => {
  t.plan(2);
  t.equal(isValidVersion('1.0.0'), true);
  t.equal(isValidVersion(1.0), false);
});

test('inc', t => {
  t.plan(1);
  t.equal(inc('1.0.0'), '1.0.1');
});

test('inc', t => {
  t.plan(14);
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
});

test('format', t => {
  t.plan(2);
  t.equal(format('release v%s', '1.0.0'), 'release v1.0.0');
  t.equal(format('release v%s (%s)', '1.0.0', 'name'), 'release v1.0.0 (name)');
});

test('template', t => {
  t.plan(2);
  t.equal(template('release v${v}', { v: '1.0.0' }), 'release v1.0.0');
  t.equal(template('release v${v} (${name})', { v: '1.0.0', name: 'name' }), 'release v1.0.0 (name)');
});

test('isSameRepo', t => {
  t.plan(1);
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
});
