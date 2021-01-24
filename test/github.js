const test = require('ava');
const sinon = require('sinon');
const { RequestError } = require('@octokit/request-error');
const GitHub = require('../lib/plugin/github/GitHub');
const { factory, runTasks } = require('./util');
const {
  interceptAuthentication,
  interceptCollaborator,
  interceptListReleases,
  interceptCreate,
  interceptUpdate,
  interceptAsset
} = require('./stub/github');

const tokenRef = 'GITHUB_TOKEN';
const pushRepo = 'git://github.com:user/repo';
const host = 'github.com';
const git = { changelog: null };

test.serial('should validate token', async t => {
  const tokenRef = 'MY_GITHUB_TOKEN';
  const options = { github: { release: true, tokenRef, pushRepo } };
  const github = factory(GitHub, { options });
  delete process.env[tokenRef];

  await t.throwsAsync(github.init(), {
    message: /^Environment variable "MY_GITHUB_TOKEN" is required for GitHub releases/
  });
  process.env[tokenRef] = '123'; // eslint-disable-line require-atomic-updates

  interceptAuthentication();
  interceptCollaborator();
  await t.notThrowsAsync(github.init());
});

test('should release and upload assets', async t => {
  const asset = 'file1';
  const options = {
    git,
    github: {
      pushRepo,
      tokenRef,
      release: true,
      releaseName: 'Release ${tagName}',
      releaseNotes: 'echo Custom notes',
      assets: `test/resources/${asset}`
    }
  };
  const github = factory(GitHub, { options });
  const exec = sinon.stub(github.shell, 'exec').callThrough();
  exec.withArgs('git describe --tags --match=* --abbrev=0').resolves('2.0.1');

  interceptAuthentication();
  interceptCollaborator();
  interceptCreate({ body: { tag_name: '2.0.2', name: 'Release 2.0.2', body: 'Custom notes' } });
  interceptAsset({ body: asset });

  await runTasks(github);

  const { isReleased, releaseUrl } = github.getContext();
  t.true(isReleased);
  t.is(releaseUrl, 'https://github.com/user/repo/releases/tag/2.0.2');
  exec.restore();
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
  const github = factory(GitHub, { options });
  const exec = sinon.stub(github.shell, 'exec').callThrough();
  exec.withArgs('git describe --tags --match=* --abbrev=0').resolves('2.0.1');

  interceptAuthentication();
  interceptCollaborator();
  interceptCreate({ body: { tag_name: '2.0.2', name: 'Release 2.0.2', body: null, prerelease: true, draft: true } });

  await runTasks(github);

  const { isReleased, releaseUrl } = github.getContext();
  t.true(isReleased);
  t.is(releaseUrl, 'https://github.com/user/repo/releases/tag/2.0.2');
  exec.restore();
});

test('should update release and upload assets', async t => {
  const asset = 'file1';
  const options = {
    increment: false,
    isUpdate: true,
    git,
    github: {
      pushRepo,
      tokenRef,
      release: true,
      releaseName: 'Release ${tagName}',
      releaseNotes: 'echo Custom notes',
      assets: `test/resources/${asset}`
    }
  };
  const github = factory(GitHub, { options });
  const exec = sinon.stub(github.shell, 'exec').callThrough();
  exec.withArgs('git describe --tags --match=* --abbrev=0').resolves('2.0.1');
  exec.withArgs('git rev-list 2.0.1 --tags --max-count=1').resolves('71f1812');
  exec.withArgs('git describe --tags --match=* --abbrev=0 71f1812').resolves('2.0.1');

  interceptAuthentication();
  interceptCollaborator();
  interceptListReleases({ tag_name: '2.0.1' });
  interceptUpdate({ body: { tag_name: '2.0.1', name: 'Release 2.0.1', body: 'Custom notes' } });
  interceptAsset({ body: asset });

  await runTasks(github);

  const { isReleased, releaseUrl } = github.getContext();
  t.true(isReleased);
  t.is(releaseUrl, 'https://github.com/user/repo/releases/tag/2.0.1');
  exec.restore();
});

test('should release to enterprise host', async t => {
  const github = factory(GitHub, { options: { git, github: { tokenRef } } });
  const exec = sinon.stub(github.shell, 'exec').callThrough();
  exec.withArgs('git remote get-url origin').resolves(`https://github.example.org/user/repo`);
  exec.withArgs('git config --get remote.origin.url').resolves(`https://github.example.org/user/repo`);
  exec.withArgs('git describe --tags --match=* --abbrev=0').resolves(`1.0.0`);

  const remote = { api: 'https://github.example.org/api/v3', host: 'github.example.org' };
  interceptAuthentication(remote);
  interceptCollaborator(remote);
  interceptCreate(Object.assign({ body: { tag_name: '1.0.1' } }, remote));

  await runTasks(github);

  const { isReleased, releaseUrl } = github.getContext();
  t.true(isReleased);
  t.is(releaseUrl, `https://github.example.org/user/repo/releases/tag/1.0.1`);
  exec.restore();
});

test('should release to alternative host and proxy', async t => {
  const remote = { api: 'https://my-custom-host.org/api/v3', host: 'my-custom-host.org' };
  interceptAuthentication(remote);
  interceptCollaborator(remote);
  interceptCreate(Object.assign({ body: { tag_name: '1.0.1' } }, remote));
  const options = {
    git,
    github: {
      tokenRef,
      pushRepo: `git://my-custom-host.org:user/repo`,
      host: 'my-custom-host.org',
      proxy: 'http://proxy:8080'
    }
  };
  const github = factory(GitHub, { options });
  const exec = sinon.stub(github.shell, 'exec').callThrough();
  exec.withArgs('git describe --tags --match=* --abbrev=0').resolves('1.0.0');

  await runTasks(github);

  const { isReleased, releaseUrl } = github.getContext();
  t.true(isReleased);
  t.is(releaseUrl, `https://my-custom-host.org/user/repo/releases/tag/1.0.1`);
  exec.restore();
});

test('should release to git.pushRepo', async t => {
  const remote = { api: 'https://my-custom-host.org/api/v3', host: 'my-custom-host.org' };
  interceptCreate(Object.assign({ body: { tag_name: '1.0.1' } }, remote));
  const options = { git: { pushRepo: 'upstream', changelog: null }, github: { tokenRef, skipChecks: true } };
  const github = factory(GitHub, { options });
  const exec = sinon.stub(github.shell, 'exec').callThrough();
  exec.withArgs('git describe --tags --match=* --abbrev=0').resolves('1.0.0');
  exec.withArgs('git remote get-url upstream').resolves('https://my-custom-host.org/user/repo');

  await runTasks(github);

  const { isReleased, releaseUrl } = github.getContext();
  t.true(isReleased);
  t.is(releaseUrl, 'https://my-custom-host.org/user/repo/releases/tag/1.0.1');
  exec.restore();
});

test('should throw for unauthenticated user', async t => {
  const options = { github: { tokenRef, pushRepo, host } };
  const github = factory(GitHub, { options });
  const stub = sinon.stub(github.client.users, 'getAuthenticated');
  stub.throws(new RequestError('Bad credentials', 401, { request: { url: '', headers: {} } }));

  await t.throwsAsync(runTasks(github), {
    message: /^Could not authenticate with GitHub using environment variable "GITHUB_TOKEN"/
  });

  t.is(stub.callCount, 1);
  stub.restore();
});

test('should throw for non-collaborator', async t => {
  interceptAuthentication({ username: 'john' });
  const options = { github: { tokenRef, pushRepo, host } };
  const github = factory(GitHub, { options });
  const stub = sinon.stub(github.client.repos, 'checkCollaborator');
  stub.throws(new RequestError('HttpError', 401, { request: { url: '', headers: {} } }));

  await t.throwsAsync(runTasks(github), { message: /^User john is not a collaborator for user\/repo/ });

  stub.restore();
});

test.serial('should skip authentication and collaborator checks when running on GitHub Actions', async t => {
  process.env.GITHUB_ACTIONS = 1;
  process.env.GITHUB_ACTOR = 'release-it';

  const options = { github: { tokenRef } };
  const github = factory(GitHub, { options });
  const authStub = sinon.stub(github, 'isAuthenticated');
  const collaboratorStub = sinon.stub(github, 'isCollaborator');

  await t.notThrowsAsync(github.init());

  t.is(authStub.callCount, 0);
  t.is(collaboratorStub.callCount, 0);
  t.is(github.getContext('username'), 'release-it');

  authStub.restore();
  collaboratorStub.restore();
  delete process.env.GITHUB_ACTIONS;
  delete process.env.GITHUB_ACTOR;
});

test('should handle octokit client error (without retries)', async t => {
  const github = factory(GitHub, { options: { github: { tokenRef, pushRepo, host } } });
  const stub = sinon.stub(github.client.repos, 'createRelease');
  stub.throws(new RequestError('Not found', 404, { request: { url: '', headers: {} } }));
  interceptAuthentication();
  interceptCollaborator();

  await t.throwsAsync(runTasks(github), { message: /^404 \(Not found\)/ });

  t.is(stub.callCount, 1);
  stub.restore();
});

test('should handle octokit client error (with retries)', async t => {
  const options = { github: { tokenRef, pushRepo, host, retryMinTimeout: 0 } };
  const github = factory(GitHub, { options });
  const stub = sinon.stub(github.client.repos, 'createRelease');
  stub.throws(new RequestError('Request failed', 500, { request: { url: '', headers: {} } }));
  interceptAuthentication();
  interceptCollaborator();

  await t.throwsAsync(runTasks(github), { message: /^500 \(Request failed\)/ });

  t.is(stub.callCount, 3);
  stub.restore();
});

test('should not call octokit client in dry run', async t => {
  const options = { 'dry-run': true, git, github: { tokenRef, pushRepo, releaseName: 'R ${version}', assets: ['*'] } };
  const github = factory(GitHub, { options });
  const spy = sinon.spy(github, 'client', ['get']);
  const exec = sinon.stub(github.shell, 'exec').callThrough();
  exec.withArgs('git describe --tags --match=* --abbrev=0').resolves('v1.0.0');

  await runTasks(github);

  t.is(spy.get.callCount, 0);
  t.is(github.log.exec.args[0][0], 'octokit repos.createRelease "R 1.0.1" (v1.0.1)');
  t.is(github.log.exec.lastCall.args[0], 'octokit repos.uploadReleaseAssets');
  const { isReleased, releaseUrl } = github.getContext();
  t.true(isReleased);
  t.is(releaseUrl, 'https://github.com/user/repo/releases/tag/v1.0.1');
  spy.restore();
  exec.restore();
});

test('should skip checks', async t => {
  const options = { github: { tokenRef, skipChecks: true } };
  const github = factory(GitHub, { options });
  await t.notThrowsAsync(github.init());
});
