const test = require('ava');
const sinon = require('sinon');
const GitHub = require('../lib/plugin/github/GitHub');
const { factory, runTasks } = require('./util');
const { GitHubClientError } = require('../lib/errors');
const { interceptDraft, interceptPublish, interceptAsset } = require('./stub/github');
const HttpError = require('@octokit/request/lib/http-error');

const tokenRef = 'GITHUB_TOKEN';

test('should validate token', async t => {
  const tokenRef = 'MY_GITHUB_TOKEN';
  const options = { github: { release: true, tokenRef } };
  const github = factory(GitHub, { options });
  delete process.env[tokenRef];

  await t.throwsAsync(github.init(), /Environment variable "MY_GITHUB_TOKEN" is required for GitHub releases/);
  process.env[tokenRef] = '123';
  await t.notThrowsAsync(github.init());
});

test('should release and upload assets', async t => {
  const options = {
    git: { tagName: 'v${version}' },
    github: {
      remoteUrl: 'git://github.com:user/repo',
      tokenRef,
      release: true,
      releaseName: 'Release ${version}',
      releaseNotes: 'echo Custom notes',
      assets: 'test/resources/file1'
    }
  };
  const github = factory(GitHub, { options });
  const exec = sinon.stub(github.shell, 'exec').callThrough();
  exec.withArgs('git describe --tags --abbrev=0').resolves('2.0.1');

  interceptDraft({
    body: { tag_name: 'v2.0.2', name: 'Release 2.0.2', body: 'Custom notes', prerelease: false, draft: true }
  });
  interceptPublish({ body: { draft: false, tag_name: 'v2.0.2' } });
  interceptAsset({ body: 'file1' });

  await runTasks(github);

  t.true(github.isReleased);
  t.is(github.getReleaseUrl(), `https://github.com/user/repo/releases/tag/v2.0.2`);
  exec.restore();
});

test('should release to enterprise host', async t => {
  const github = factory(GitHub, { options: { github: { tokenRef } } });
  const exec = sinon.stub(github.shell, 'exec').callThrough();
  exec.withArgs('git config --get remote.origin.url').resolves(`https://github.example.org/user/repo`);
  exec.withArgs('git describe --tags --abbrev=0').resolves(`1.0.0`);

  const remote = { api: 'https://github.example.org/api/v3', host: 'github.example.org' };
  interceptDraft(Object.assign({ body: { tag_name: '1.0.1', name: '', prerelease: false, draft: true } }, remote));
  interceptPublish(Object.assign({ body: { draft: false, tag_name: '1.0.1' } }, remote));

  await runTasks(github);

  t.true(github.isReleased);
  t.is(github.getReleaseUrl(), `https://github.example.org/user/repo/releases/tag/1.0.1`);
  exec.restore();
});

test('should release to alternative host and proxy', async t => {
  const remote = { api: 'https://my-custom-host.org/api/v3', host: 'my-custom-host.org' };
  interceptDraft(Object.assign({ body: { tag_name: '1.0.1', name: '', prerelease: false, draft: true } }, remote));
  interceptPublish(Object.assign({ body: { draft: false, tag_name: '1.0.1' } }, remote));
  const options = {
    github: {
      tokenRef,
      remoteUrl: `git://my-custom-host.org:user/repo`,
      host: 'my-custom-host.org',
      proxy: 'http://proxy:8080'
    }
  };
  const github = factory(GitHub, { options });
  const exec = sinon.stub(github.shell, 'exec').callThrough();
  exec.withArgs('git describe --tags --abbrev=0').resolves('1.0.0');

  await runTasks(github);

  t.true(github.isReleased);
  t.is(github.getReleaseUrl(), `https://my-custom-host.org/user/repo/releases/tag/1.0.1`);
  exec.restore();
});

test('should handle octokit client error (without retries)', async t => {
  const github = factory(GitHub, { options: { github: { tokenRef } } });
  const stub = sinon.stub(github.client.repos, 'createRelease');
  stub.throws(new HttpError('Not found', 404, null, { url: '', headers: {} }));

  await t.throwsAsync(runTasks(github), { instanceOf: GitHubClientError, message: '404 (Not found)' });

  t.is(stub.callCount, 1);
  stub.restore();
});

test('should handle octokit client error (with retries)', async t => {
  const options = { github: { tokenRef, retryMinTimeout: 0 } };
  const github = factory(GitHub, { options });
  const stub = sinon.stub(github.client.repos, 'createRelease');
  stub.throws(new HttpError('Request failed', 500, null, { url: '', headers: {} }));

  await t.throwsAsync(runTasks(github), { instanceOf: GitHubClientError, message: '500 (Request failed)' });

  t.is(stub.callCount, 3);
  stub.restore();
});

test('should not call octokit client in dry run', async t => {
  const options = {
    git: { tagName: 'v${version}' },
    github: { tokenRef, remoteUrl: `git://github.com:user/repo`, releaseName: 'R ${version}', assets: ['*'] }
  };
  const github = factory(GitHub, { options, global: { isDryRun: true } });
  const spy = sinon.spy(github, 'client', ['get']);
  const exec = sinon.stub(github.shell, 'exec').callThrough();
  exec.withArgs('git describe --tags --abbrev=0').resolves('1.0.0');

  await runTasks(github);

  t.is(spy.get.callCount, 0);
  t.is(github.log.exec.args[0][0], 'octokit releases#draftRelease "R 1.0.1" (v1.0.1)');
  t.is(github.log.exec.args[1][0], 'octokit releases#uploadAssets');
  t.is(github.log.exec.lastCall.args[0], 'octokit releases#publishRelease (v1.0.1)');
  t.is(github.getReleaseUrl(), `https://github.com/user/repo/releases/tag/v1.0.1`);
  t.is(github.isReleased, true);
  spy.restore();
  exec.restore();
});
