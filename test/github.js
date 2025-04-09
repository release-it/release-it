import test, { describe, before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { RequestError } from '@octokit/request-error';
import GitHub from '../lib/plugin/github/GitHub.js';
import { getSearchQueries } from '../lib/plugin/github/util.js';
import { factory, runTasks } from './util/index.js';
import {
  interceptAuthentication,
  interceptCollaborator,
  interceptListReleases,
  interceptCreate,
  interceptUpdate,
  interceptAsset
} from './stub/github.js';
import { mockFetch } from './util/mock.js';

describe('github', () => {
  const tokenRef = 'GITHUB_TOKEN';
  const pushRepo = 'git://github.com/user/repo';
  const host = 'github.com';
  const git = { changelog: '' };
  const requestErrorOptions = { request: { url: '', headers: {} }, response: { headers: {} } };

  const [mocker, api, assets, example, custom] = mockFetch([
    'https://api.github.com',
    'https://uploads.github.com',
    'https://github.example.org/api/v3',
    'https://custom.example.org/api/v3'
  ]);

  before(() => {
    mocker.mockGlobal();
  });

  afterEach(() => {
    mocker.clearAll();
  });

  after(() => {
    mocker.unmockGlobal();
  });

  test('should check token and perform checks', async () => {
    const tokenRef = 'MY_GITHUB_TOKEN';
    const options = { github: { release: true, tokenRef, pushRepo } };
    const github = await factory(GitHub, { options });

    interceptAuthentication(api);
    interceptCollaborator(api);
    await assert.doesNotReject(github.init());
  });

  test('should check token and warn', async () => {
    const tokenRef = 'MY_GITHUB_TOKEN';
    const options = { github: { release: true, tokenRef, pushRepo } };
    const github = await factory(GitHub, { options });
    delete process.env[tokenRef];

    await assert.doesNotReject(github.init());

    assert.equal(
      github.log.warn.mock.calls[0].arguments[0],
      'Environment variable "MY_GITHUB_TOKEN" is required for automated GitHub Releases.'
    );
    assert.equal(github.log.warn.mock.calls[1].arguments[0], 'Falling back to web-based GitHub Release.');
  });

  test('should release and upload assets', async t => {
    const options = {
      git,
      github: {
        pushRepo,
        tokenRef,
        release: true,
        releaseName: 'Release ${tagName}',
        releaseNotes: 'echo Custom notes',
        assets: 'test/resources/file-v${version}.txt'
      }
    };
    const github = await factory(GitHub, { options });

    const original = github.shell.exec.bind(github.shell);
    t.mock.method(github.shell, 'exec', (...args) => {
      if (args[0] === 'git log --pretty=format:"* %s (%h)" ${from}...${to}') return Promise.resolve('');
      if (args[0] === 'git describe --tags --match=* --abbrev=0') return Promise.resolve('2.0.1');
      return original(...args);
    });

    interceptAuthentication(api);
    interceptCollaborator(api);
    interceptCreate(api, { body: { tag_name: '2.0.2', name: 'Release 2.0.2', body: 'Custom notes' } });
    interceptAsset(assets, { body: '*' });

    await runTasks(github);

    const { isReleased, releaseUrl } = github.getContext();
    assert(isReleased);
    assert.equal(releaseUrl, 'https://github.com/user/repo/releases/tag/2.0.2');
  });

  test('should create a pre-release and draft release notes', async t => {
    const options = {
      git,
      github: {
        pushRepo,
        tokenRef,
        release: true,
        releaseName: 'Release ${tagName}',
        preRelease: true,
        draft: true
      }
    };
    const github = await factory(GitHub, { options });

    const original = github.shell.exec.bind(github.shell);
    t.mock.method(github.shell, 'exec', (...args) => {
      if (args[0] === 'git log --pretty=format:"* %s (%h)" ${from}...${to}') return Promise.resolve('');
      if (args[0] === 'git describe --tags --match=* --abbrev=0') return Promise.resolve('2.0.1');
      return original(...args);
    });

    interceptAuthentication(api);
    interceptCollaborator(api);
    interceptCreate(api, { body: { tag_name: '2.0.2', name: 'Release 2.0.2', prerelease: true, draft: true } });

    await runTasks(github);

    const { isReleased, releaseUrl } = github.getContext();
    assert(isReleased);
    assert.equal(releaseUrl, 'https://github.com/user/repo/releases/tag/2.0.2');
  });

  test('should create auto-generated release notes', async t => {
    const options = {
      git,
      github: {
        pushRepo,
        tokenRef,
        release: true,
        releaseName: 'Release ${tagName}',
        autoGenerate: true
      }
    };
    const github = await factory(GitHub, { options });

    const original = github.shell.exec.bind(github.shell);
    t.mock.method(github.shell, 'exec', (...args) => {
      if (args[0] === 'git describe --tags --match=* --abbrev=0') return Promise.resolve('2.0.1');
      return original(...args);
    });

    interceptAuthentication(api);
    interceptCollaborator(api);
    interceptCreate(api, {
      body: { tag_name: '2.0.2', name: 'Release 2.0.2', generate_release_notes: true, body: '' }
    });

    await runTasks(github);

    const { isReleased, releaseUrl } = github.getContext();
    assert(isReleased);
    assert.equal(releaseUrl, 'https://github.com/user/repo/releases/tag/2.0.2');
  });

  test('should update release and upload assets', async t => {
    const asset = 'file1';
    const options = {
      increment: false,
      git,
      github: {
        update: true,
        pushRepo,
        tokenRef,
        release: true,
        releaseName: 'Release ${tagName}',
        releaseNotes: 'echo Custom notes',
        assets: `test/resources/${asset}`
      }
    };
    const github = await factory(GitHub, { options });

    const original = github.shell.exec.bind(github.shell);
    t.mock.method(github.shell, 'exec', (...args) => {
      if (args[0] === 'git log --pretty=format:"* %s (%h)" ${from}...${to}') return Promise.resolve('');
      if (args[0] === 'git describe --tags --match=* --abbrev=0') return Promise.resolve('2.0.1');
      if (args[0] === 'git rev-list 2.0.1 --tags --max-count=1') return Promise.resolve('a123456');
      if (args[0] === 'git describe --tags --match=* --abbrev=0') return Promise.resolve('2.0.1');
      return original(...args);
    });

    interceptAuthentication(api);
    interceptCollaborator(api);
    interceptListReleases(api, { tag_name: '2.0.1' });
    interceptUpdate(api, { body: { tag_name: '2.0.1', name: 'Release 2.0.1', body: 'Custom notes' } });
    interceptAsset(assets, { body: asset });

    await runTasks(github);

    const { isReleased, releaseUrl } = github.getContext();
    assert(isReleased);
    assert.equal(releaseUrl, 'https://github.com/user/repo/releases/tag/2.0.1');
  });

  test('should create custom release notes using releaseNotes function', async t => {
    const options = {
      git,
      github: {
        pushRepo,
        tokenRef,
        release: true,
        releaseName: 'Release ${tagName}',
        releaseNotes(context) {
          return `Custom notes for tag ${context.tagName}`;
        }
      }
    };
    const github = await factory(GitHub, { options });

    const original = github.shell.exec.bind(github.shell);
    t.mock.method(github.shell, 'exec', (...args) => {
      if (args[0] === 'git describe --tags --match=* --abbrev=0') return Promise.resolve('2.0.1');
      return original(...args);
    });

    interceptAuthentication(api);
    interceptCollaborator(api);
    interceptCreate(api, {
      body: { tag_name: '2.0.2', name: 'Release 2.0.2', body: 'Custom notes for tag 2.0.2' }
    });

    await runTasks(github);

    const { isReleased, releaseUrl } = github.getContext();
    assert(isReleased);
    assert.equal(releaseUrl, 'https://github.com/user/repo/releases/tag/2.0.2');
  });

  test('should create new release for unreleased tag', async t => {
    const options = {
      increment: false,
      git,
      github: {
        update: true,
        pushRepo,
        tokenRef,
        release: true,
        releaseName: 'Release ${tagName}',
        releaseNotes: 'echo Custom notes'
      }
    };
    const github = await factory(GitHub, { options });

    const original = github.shell.exec.bind(github.shell);
    t.mock.method(github.shell, 'exec', (...args) => {
      if (args[0] === 'git log --pretty=format:"* %s (%h)" ${from}...${to}') return Promise.resolve('');
      if (args[0] === 'git describe --tags --match=* --abbrev=0') return Promise.resolve('2.0.1');
      if (args[0] === 'git rev-list 2.0.1 --tags --max-count=1') return Promise.resolve('b123456');
      if (args[0] === 'git describe --tags --abbrev=0 "b123456^"') return Promise.resolve('2.0.1');
      return original(...args);
    });

    interceptAuthentication(api);
    interceptCollaborator(api);
    interceptListReleases(api, { tag_name: '2.0.0' });
    interceptCreate(api, { body: { tag_name: '2.0.1', name: 'Release 2.0.1', body: 'Custom notes' } });

    await runTasks(github);

    const { isReleased, releaseUrl } = github.getContext();
    assert(isReleased);
    assert.equal(releaseUrl, 'https://github.com/user/repo/releases/tag/2.0.1');
  });

  test('should release to enterprise host', async t => {
    const options = { git, github: { tokenRef, pushRepo: 'git://github.example.org/user/repo' } };
    const github = await factory(GitHub, { options });

    const original = github.shell.exec.bind(github.shell);
    t.mock.method(github.shell, 'exec', (...args) => {
      if (args[0] === 'git remote get-url origin') return Promise.resolve(`https://github.example.org/user/repo`);
      if (args[0] === 'git config --get remote.origin.url')
        return Promise.resolve('https://github.example.org/user/repo');
      if (args[0] === 'git describe --tags --match=* --abbrev=0') return Promise.resolve('1.0.0');
      return original(...args);
    });

    interceptAuthentication(example);
    interceptCollaborator(example);
    interceptCreate(example, {
      api: 'https://github.example.org/api/v3',
      host: 'github.example.org',
      body: { tag_name: '1.0.1' }
    });

    await runTasks(github);

    const { isReleased, releaseUrl } = github.getContext();
    assert(isReleased);
    assert.equal(releaseUrl, 'https://github.example.org/user/repo/releases/tag/1.0.1');
  });

  test('should release to alternative host and proxy', async t => {
    const options = {
      git,
      github: {
        tokenRef,
        pushRepo: `git://custom.example.org/user/repo`,
        host: 'custom.example.org',
        proxy: 'http://proxy:8080'
      }
    };
    const github = await factory(GitHub, { options });

    const original = github.shell.exec.bind(github.shell);
    t.mock.method(github.shell, 'exec', (...args) => {
      if (args[0] === 'git log --pretty=format:"* %s (%h)" ${from}...${to}') return Promise.resolve('');
      if (args[0] === 'git describe --tags --match=* --abbrev=0') return Promise.resolve('1.0.0');
      return original(...args);
    });

    interceptAuthentication(custom);
    interceptCollaborator(custom);
    interceptCreate(custom, {
      api: 'https://custom.example.org/api/v3',
      host: 'custom.example.org',
      body: { tag_name: '1.0.1' }
    });

    await runTasks(github);

    const { isReleased, releaseUrl } = github.getContext();
    assert(isReleased);
    assert.equal(releaseUrl, 'https://custom.example.org/user/repo/releases/tag/1.0.1');
    assert.equal(github.options.proxy, 'http://proxy:8080');
  });

  test('should release to git.pushRepo', async t => {
    const options = { git: { pushRepo: 'upstream', changelog: '' }, github: { tokenRef, skipChecks: true } };
    const github = await factory(GitHub, { options });

    const original = github.shell.exec.bind(github.shell);
    t.mock.method(github.shell, 'exec', (...args) => {
      if (args[0] === 'git log --pretty=format:"* %s (%h)" ${from}...${to}') return Promise.resolve('');
      if (args[0] === 'git describe --tags --match=* --abbrev=0') return Promise.resolve('1.0.0');
      if (args[0] === 'git remote get-url upstream') return Promise.resolve('https://custom.example.org/user/repo');
      return original(...args);
    });

    interceptCreate(custom, {
      api: 'https://custom.example.org/api/v3',
      host: 'custom.example.org',
      body: { tag_name: '1.0.1' }
    });

    await runTasks(github);

    const { isReleased, releaseUrl } = github.getContext();
    assert(isReleased);
    assert.equal(releaseUrl, 'https://custom.example.org/user/repo/releases/tag/1.0.1');
  });

  const testSkipOnActions = process.env.GITHUB_ACTIONS ? test.skip : test;

  testSkipOnActions('should throw for unauthenticated user', async t => {
    const options = { github: { tokenRef, pushRepo, host } };
    const github = await factory(GitHub, { options });

    const getAuthenticated = t.mock.method(github.client.users, 'getAuthenticated', () => {
      throw new RequestError('Bad credentials', 401, requestErrorOptions);
    });

    await assert.rejects(runTasks(github), {
      message: /Could not authenticate with GitHub using environment variable "GITHUB_TOKEN"/
    });

    assert.equal(getAuthenticated.mock.callCount(), 1);
  });

  testSkipOnActions('should throw for non-collaborator', async t => {
    const options = { github: { tokenRef, pushRepo, host } };
    const github = await factory(GitHub, { options });

    t.mock.method(github.client.repos, 'checkCollaborator', () => {
      throw new RequestError('HttpError', 401, requestErrorOptions);
    });

    interceptAuthentication(api, { username: 'john' });

    await assert.rejects(runTasks(github), /User john is not a collaborator for user\/repo/);
  });

  test('should skip authentication and collaborator checks when running on GitHub Actions', async t => {
    const { GITHUB_ACTIONS, GITHUB_ACTOR } = process.env;
    if (!GITHUB_ACTIONS) {
      process.env.GITHUB_ACTIONS = 1;
      process.env.GITHUB_ACTOR = 'webpro';
    }

    const options = { github: { tokenRef } };
    const github = await factory(GitHub, { options });
    const authStub = t.mock.method(github, 'isAuthenticated');
    const collaboratorStub = t.mock.method(github, 'isCollaborator');

    await assert.doesNotReject(github.init());

    assert.equal(authStub.mock.callCount(), 0);
    assert.equal(collaboratorStub.mock.callCount(), 0);
    assert.equal(github.getContext('username'), process.env.GITHUB_ACTOR);

    if (!GITHUB_ACTIONS) {
      process.env.GITHUB_ACTIONS = GITHUB_ACTIONS || '';
      process.env.GITHUB_ACTOR = GITHUB_ACTOR || '';
    }
  });

  test('should handle octokit client error (without retries)', async t => {
    const github = await factory(GitHub, { options: { github: { tokenRef, pushRepo, host } } });
    const createRelease = t.mock.method(github.client.repos, 'createRelease', () => {
      throw new RequestError('Not found', 404, requestErrorOptions);
    });

    interceptAuthentication(api);
    interceptCollaborator(api);

    await assert.rejects(runTasks(github), /404 \(Not found\)/);

    assert.equal(createRelease.mock.callCount(), 1);
  });

  test('should handle octokit client error (with retries)', async t => {
    const options = { github: { tokenRef, pushRepo, host, retryMinTimeout: 0 } };
    const github = await factory(GitHub, { options });

    const createRelease = t.mock.method(github.client.repos, 'createRelease', () => {
      throw new RequestError('Request failed', 500, requestErrorOptions);
    });

    interceptAuthentication(api);
    interceptCollaborator(api);

    await assert.rejects(runTasks(github), /500 \(Request failed\)/);

    assert.equal(createRelease.mock.callCount(), 3);
  });

  test('should not call octokit client in dry run', async t => {
    const options = {
      'dry-run': true,
      git,
      github: { tokenRef, pushRepo, releaseName: 'R ${version}', assets: ['*'] }
    };
    const github = await factory(GitHub, { options });

    const get = t.mock.getter(github, 'client');
    const original = github.shell.exec.bind(github.shell);
    t.mock.method(github.shell, 'exec', (...args) => {
      if (args[0] === 'git log --pretty=format:"* %s (%h)" ${from}...${to}') return Promise.resolve('');
      if (args[0] === 'git describe --tags --match=* --abbrev=0') return Promise.resolve('v1.0.0');
      return original(...args);
    });

    await runTasks(github);

    assert.equal(get.mock.callCount(), 0);
    assert.equal(github.log.exec.mock.calls[1].arguments[0], 'octokit repos.createRelease "R 1.0.1" (v1.0.1)');
    assert.equal(github.log.exec.mock.calls.at(-1).arguments[0], 'octokit repos.uploadReleaseAssets');
    const { isReleased, releaseUrl } = github.getContext();
    assert(isReleased);
    assert.equal(releaseUrl, 'https://github.com/user/repo/releases/tag/v1.0.1');
  });

  test('should generate GitHub web release url', async t => {
    const options = {
      github: {
        pushRepo,
        release: true,
        web: true,
        releaseName: 'Release ${tagName}',
        releaseNotes: 'echo Custom notes'
      }
    };
    const github = await factory(GitHub, { options });

    const original = github.shell.exec.bind(github.shell);
    t.mock.method(github.shell, 'exec', (...args) => {
      if (args[0] === 'git log --pretty=format:"* %s (%h)" ${from}...${to}') return Promise.resolve('');
      if (args[0] === 'git describe --tags --match=* --abbrev=0') return Promise.resolve('2.0.1');
      return original(...args);
    });

    await runTasks(github);

    const { isReleased, releaseUrl } = github.getContext();
    assert(isReleased);
    assert.equal(
      releaseUrl,
      'https://github.com/user/repo/releases/new?tag=2.0.2&title=Release+2.0.2&body=Custom+notes&prerelease=false'
    );
  });

  test('should generate GitHub web release url for enterprise host', async t => {
    const options = {
      git,
      github: {
        pushRepo: 'git@custom.example.org:user/repo',
        release: true,
        web: true,
        host: 'custom.example.org',
        releaseName: 'The Launch',
        releaseNotes: 'echo It happened'
      }
    };
    const github = await factory(GitHub, { options });

    const original = github.shell.exec.bind(github.shell);
    t.mock.method(github.shell, 'exec', (...args) => {
      if (args[0] === 'git log --pretty=format:"* %s (%h)" ${from}...${to}') return Promise.resolve('');
      if (args[0] === 'git describe --tags --match=* --abbrev=0') return Promise.resolve('2.0.1');
      return original(...args);
    });

    await runTasks(github);

    const { isReleased, releaseUrl } = github.getContext();
    assert(isReleased);
    assert.equal(
      releaseUrl,
      'https://custom.example.org/user/repo/releases/new?tag=2.0.2&title=The+Launch&body=It+happened&prerelease=false'
    );
  });

  test.skip('should truncate long body', async t => {
    const releaseNotes = 'a'.repeat(125001);
    const body = 'a'.repeat(124000) + '...';
    const options = {
      git,
      github: {
        pushRepo,
        tokenRef,
        release: true,
        releaseName: 'Release ${tagName}',
        releaseNotes: 'echo ' + releaseNotes
      }
    };
    const github = await factory(GitHub, { options });

    const original = github.shell.exec.bind(github.shell);
    t.mock.method(github.shell, 'exec', (...args) => {
      if (args[0] === 'git log --pretty=format:"* %s (%h)" ${from}...${to}') return Promise.resolve('');
      if (args[0] === 'git describe --tags --match=* --abbrev=0') return Promise.resolve('2.0.1');
      return original(...args);
    });

    interceptAuthentication(api);
    interceptCollaborator(api);
    interceptCreate(api, { body: { tag_name: '2.0.2', name: 'Release 2.0.2', body } });

    await runTasks(github);

    const { isReleased, releaseUrl } = github.getContext();
    assert(isReleased);
    assert.equal(releaseUrl, 'https://github.com/user/repo/releases/tag/2.0.2');
  });

  test('should generate search queries correctly', () => {
    const generateCommit = () => Math.random().toString(36).substring(2, 9);
    const base = 'repo:owner/repo+type:pr+is:merged';
    const commits = Array.from({ length: 5 }, generateCommit);
    const separator = '+';

    const result = getSearchQueries(base, commits, separator);

    // Test case 1: Check if all commits are included in the search queries
    const allCommitsIncluded = commits.every(commit => result.some(query => query.includes(commit)));
    assert(allCommitsIncluded, 'All commits should be included in the search queries');

    assert.equal(
      commits.every(commit => result.some(query => query.includes(commit))),
      true
    );

    // Test case 2: Check if the function respects the 256 character limit
    const manyCommits = Array.from({ length: 100 }, generateCommit);
    const longResult = getSearchQueries(base, manyCommits, separator);
    assert(longResult.length > 1, 'Many commits should be split into multiple queries');
    assert(
      longResult.every(query => encodeURIComponent(query).length <= 256),
      'Each query should not exceed 256 characters after encoding'
    );
  });

  test('should create auto-generated discussion', async t => {
    const options = {
      git,
      github: {
        pushRepo,
        tokenRef,
        release: true,
        releaseName: 'Release ${tagName}',
        autoGenerate: false,
        discussionCategoryName: 'Announcement'
      }
    };
    const github = await factory(GitHub, { options });
    const original = github.shell.exec.bind(github.shell);
    t.mock.method(github.shell, 'exec', (...args) => {
      if (args[0] === 'git describe --tags --match=* --abbrev=0') return Promise.resolve('2.0.1');
      return original(...args);
    });

    interceptAuthentication(api);
    interceptCollaborator(api);
    interceptCreate(api, {
      body: {
        tag_name: '2.0.2',
        name: 'Release 2.0.2',
        generate_release_notes: false,
        body: null,
        discussion_category_name: 'Announcement'
      }
    });

    await runTasks(github);

    const { isReleased, releaseUrl, discussionUrl } = github.getContext();
    assert(isReleased);
    assert.equal(releaseUrl, 'https://github.com/user/repo/releases/tag/2.0.2');
    assert.equal(discussionUrl, 'https://github.com/user/repo/discussions/1');
  });
});
