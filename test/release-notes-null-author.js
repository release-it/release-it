import test from 'node:test';
import assert from 'node:assert/strict';
import GitHub from '../lib/plugin/github/GitHub.js';
import { factory } from './util/index.js';

const template = '* ${commit.subject} (${sha}){ - thanks @${author.login}!}';
const fixture = (extra = {}) => ({
  sha: 'abc123',
  commit: {
    message: 'Fixture change\n\nKeep the full message',
    author: { name: 'Git author', email: 'author@example.invalid' },
    comment_count: 0,
    verification: { verified: false }
  },
  author: { login: 'fixture-user' },
  ...extra
});

const setup = async (t, commits, releaseNotes = { commit: template }, options = {}) => {
  const github = await factory(GitHub, {
    options: { ...options, github: { commit: false, releaseNotes, ...options.github } }
  });
  github.setContext({ repo: { owner: 'fixture', project: 'repo' }, version: '1.1.0' });
  github.config.setContext({ latestTag: '1.0.0', tagName: '1.1.0' });
  const compareCommits = t.mock.fn(async params => {
    assert.deepEqual(params, { owner: 'fixture', repo: 'repo', base: '1.0.0', head: 'HEAD' });
    return { data: { commits } };
  });
  t.mock.getter(github, 'client', () => ({ repos: { compareCommits } }));
  return { github, compareCommits };
};

for (const [name, author] of [
  ['null author', null],
  ['missing author', undefined],
  ['missing login', {}],
  ['null login', { login: null }]
]) {
  test(`release notes omit attribution for ${name}`, async t => {
    const commit = fixture({ author });
    if (author === undefined) delete commit.author;
    const original = structuredClone(commit);
    const { github, compareCommits } = await setup(t, [commit]);
    const options = await github.getOctokitReleaseOptions();
    assert.equal(options.body, '* Fixture change (abc123)');
    assert.equal(options.tag_name, '1.1.0');
    assert.equal(compareCommits.mock.callCount(), 1);
    assert.deepEqual(commit, { ...original, commit: { ...original.commit, subject: 'Fixture change' } });
  });
}

test('release notes preserve ordinary authored notes and literal null/undefined text', async t => {
  const { github } = await setup(t, [fixture(), fixture({ sha: 'def456', author: { login: 'undefined-null-user' } })]);
  assert.equal(
    await github.renderReleaseNotes({ commit: template }),
    '* Fixture change (abc123) - thanks @fixture-user!\n* Fixture change (def456) - thanks @undefined-null-user!'
  );
});

test('release notes remove multiple incomplete blocks and preserve complete blocks', async t => {
  const { github } = await setup(t, [fixture({ author: null, committer: null })]);
  assert.equal(
    await github.renderReleaseNotes({
      commit:
        '${sha}{ by ${author.login}}{ via ${committer.login}}{ mixed ${commit.subject} ${author.login}}{ git ${commit.author.name}}{ literal}'
    }),
    'abc123 git Git author literal'
  );
});

test('release notes retain defined falsy values', async t => {
  const { github } = await setup(t, [fixture({ author: { login: '' } })]);
  assert.equal(
    await github.renderReleaseNotes({
      commit:
        '${sha}{ count=${commit.comment_count}}{ verified=${commit.verification.verified}}{ login=${author.login}}'
    }),
    'abc123 count=0 verified=false login='
  );
});

test('release notes preserve exclusions on rendered blocks without excluding commits', async t => {
  const { github } = await setup(t, [fixture(), fixture({ sha: 'def456', author: null })]);
  assert.equal(
    await github.renderReleaseNotes({
      commit: '${commit.subject} (${sha}){ @${author.login}}{ ${commit.author.name}}{ keep ${sha}}',
      excludeMatches: ['fixture-user', 'Git author']
    }),
    'Fixture change (abc123) keep abc123\nFixture change (def456) keep def456'
  );
});

test('release notes still reject invalid required placeholders', async t => {
  const { github } = await setup(t, [fixture({ author: null })]);
  await assert.rejects(github.renderReleaseNotes({ commit: '${author.login}' }), TypeError);
});

test('release notes preserve template expressions', async t => {
  const { github } = await setup(t, [fixture()]);
  assert.equal(
    await github.renderReleaseNotes({ commit: '${sha}{ ${author.login.toUpperCase()}}' }),
    'abc123 FIXTURE-USER'
  );
});

test('release notes preserve Eta scope expressions in optional blocks', async t => {
  const { github } = await setup(t, [fixture(), fixture({ sha: 'def456', author: null })]);
  assert.equal(
    await github.renderReleaseNotes({ commit: '${sha}{ by ${it.author.login}}{ pi=${Math.PI}}' }),
    'abc123 by fixture-user pi=3.141592653589793\ndef456 pi=3.141592653589793'
  );
});

test('release notes still reject optional blocks with other template errors', async t => {
  const { github } = await setup(t, [fixture()]);
  await assert.rejects(
    github.renderReleaseNotes({ commit: '${sha}{ ${commit.subject.missing()}}' }),
    /commit\.subject\.missing is not a function/
  );
});

for (const options of [{ github: { commit: true } }, { increment: false }]) {
  test(`release notes still omit the release commit with ${JSON.stringify(options)}`, async t => {
    const { github } = await setup(t, [fixture(), fixture({ sha: 'release', author: null })], undefined, options);
    assert.equal(
      await github.renderReleaseNotes({ commit: template }),
      '* Fixture change (abc123) - thanks @fixture-user!'
    );
  });
}

test('release notes preserve an empty commit list', async t => {
  const { github } = await setup(t, []);
  assert.equal(await github.renderReleaseNotes({ commit: template }), '');
});
