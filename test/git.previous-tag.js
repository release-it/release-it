import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import Git from '../lib/plugin/git/Git.js';
import Shell from '../lib/shell.js';
import { factory } from './util/index.js';

function repository(t) {
  const cwd = process.cwd();
  const directory = mkdtempSync(join(tmpdir(), 'release-it-previous-tag-'));
  let sequence = 0;
  const git = (...args) =>
    execFileSync('git', args, {
      cwd: directory,
      encoding: 'utf8',
      env: {
        ...process.env,
        GIT_AUTHOR_DATE: new Date(Date.UTC(2020, 0, 1, 0, 0, sequence)).toISOString(),
        GIT_COMMITTER_DATE: new Date(Date.UTC(2020, 0, 1, 0, 0, sequence)).toISOString()
      }
    }).trim();
  git('init', '--initial-branch=test/previous-tag-fixture');
  git('config', 'user.name', 'Fixture');
  git('config', 'user.email', 'fixture@example.test');
  git('config', 'commit.gpgSign', 'false');
  git('config', 'tag.gpgSign', 'false');
  const commit = message => {
    sequence++;
    git('commit', '--allow-empty', '-m', message);
  };
  process.chdir(directory);
  t.after(() => {
    process.chdir(cwd);
    rmSync(directory, { recursive: true, force: true });
  });
  return { git, commit };
}

for (const fixture of [
  { name: 'tagName namespace', options: { tagName: 'pkg-a@${version}' }, prefix: 'pkg-a@', unrelated: 'pkg-b@2.0.0' },
  {
    name: 'all-refs namespace selection',
    options: { tagName: 'pkg-a@${version}', getLatestTagFromAllRefs: true },
    prefix: 'pkg-a@',
    unrelated: 'pkg-b@2.0.0'
  },
  {
    name: 'tagMatch with context takes precedence over tagName',
    options: { tagMatch: '${name}@*', tagName: 'other-${version}' },
    prefix: 'pkg-a@',
    unrelated: 'pkg-b@2.0.0'
  },
  { name: 'excluded prerelease', options: { tagExclude: '*-rc.*' }, prefix: 'v', unrelated: 'v1.1.0-rc.0' },
  {
    name: 'annotated tags',
    options: { tagName: 'pkg-a@${version}' },
    prefix: 'pkg-a@',
    unrelated: 'pkg-b@2.0.0',
    annotated: true
  },
  { name: 'later tag on another branch', options: {}, prefix: 'v', otherBranch: true },
  { name: 'ordinary tag history', options: {}, prefix: 'v' }
]) {
  test(`previous tag preserves ${fixture.name}`, async t => {
    const { git, commit } = repository(t);
    const tag = name => git('tag', ...(fixture.annotated ? ['-a', '-m', name] : []), name);
    const previous = `${fixture.prefix}1.0.0`;
    const latest = `${fixture.prefix}1.1.0`;
    commit('initial release');
    tag(previous);
    commit('kept change');
    if (fixture.unrelated) tag(fixture.unrelated);
    commit('release commit');
    tag(latest);
    if (fixture.otherBranch) {
      git('checkout', '-b', 'test/unrelated-release');
      commit('unrelated change');
      tag('v9.0.0');
      commit('unrelated release');
      tag('v9.1.0');
      git('checkout', 'test/previous-tag-fixture');
    }
    const shell = await factory(Shell);
    const client = await factory(Git, {
      options: { increment: false, git: { ...fixture.options, changelog: 'git log --format=%s ${from}..${to}' } },
      container: { shell }
    });
    client.config.setContext({ name: 'pkg-a' });
    const latestTag = await client.getLatestTagName();
    assert.equal(latestTag, latest);
    const secondLatestTag = await client.getSecondLatestTagName(latestTag);
    assert.equal(secondLatestTag, previous);
    client.config.setContext({ latestTag, secondLatestTag });
    assert.equal(await client.getChangelog(), 'kept change');
  });
}

test('previous tag is absent when the matching tag is the root commit', async t => {
  const { git, commit } = repository(t);
  commit('initial release');
  git('tag', 'v1.0.0');
  const shell = await factory(Shell);
  const client = await factory(Git, { container: { shell } });
  assert.equal(await client.getSecondLatestTagName(await client.getLatestTagName()), null);
});

test('previous tag is absent when no tags match', async t => {
  const { git, commit } = repository(t);
  for (const version of ['1.0.0', '1.1.0', '1.2.0']) {
    commit(`other release ${version}`);
    git('tag', `pkg-b@${version}`);
  }
  const shell = await factory(Shell);
  const client = await factory(Git, {
    options: { git: { tagMatch: 'pkg-a@*' } },
    container: { shell }
  });
  const latest = await client.getLatestTagName();
  assert.equal(latest, null);
  assert.equal(await client.getSecondLatestTagName(latest), null);
});

test('all-refs previous tag ignores tagExclude like the latest tag', async t => {
  const { git, commit } = repository(t);
  commit('stable release');
  git('tag', 'v1.0.0');
  commit('previous prerelease');
  git('tag', 'v1.1.0-rc.0');
  commit('kept change');
  commit('release commit');
  git('tag', 'v1.1.0-rc.1');
  const shell = await factory(Shell);
  const client = await factory(Git, {
    options: {
      increment: false,
      git: { getLatestTagFromAllRefs: true, tagExclude: '*-rc.*', changelog: 'git log --format=%s ${from}..${to}' }
    },
    container: { shell }
  });
  const latestTag = await client.getLatestTagName();
  assert.equal(latestTag, 'v1.1.0-rc.1');
  const secondLatestTag = await client.getSecondLatestTagName(latestTag);
  assert.equal(secondLatestTag, 'v1.1.0-rc.0');
  client.config.setContext({ latestTag, secondLatestTag });
  assert.equal(await client.getChangelog(), 'kept change');
});
