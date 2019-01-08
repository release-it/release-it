const path = require('path');
const test = require('ava');
const sinon = require('sinon');
const proxyquire = require('proxyquire');
const GitHubApi = require('@octokit/rest');
const GitHub = require('../lib/github');
const githubRequestMock = require('./mock/github.request');
const { GitHubClientError } = require('../lib/errors');
const HttpError = require('@octokit/request/lib/http-error');

test.beforeEach(t => {
  const gitHubApi = new GitHubApi();
  const GitHubApiStub = sinon.stub().returns(gitHubApi);
  const githubRequestStub = sinon.stub().callsFake(githubRequestMock);
  gitHubApi.hook.wrap('request', githubRequestStub);
  t.context.gitHubApi = gitHubApi;
  t.context.githubRequestStub = githubRequestStub;
  t.context.GitHubApiStub = GitHubApiStub;
  t.context.GitHub = proxyquire('../lib/github', {
    '@octokit/rest': GitHubApiStub
  });
});

test('github validate', async t => {
  const tokenRef = 'MY_GITHUB_TOKEN';
  const github = new GitHub({ release: true, tokenRef, remoteUrl: '' });
  delete process.env[tokenRef];
  t.throws(() => github.validate(), /Environment variable "MY_GITHUB_TOKEN" is required for GitHub releases/);
  process.env[tokenRef] = '123';
  t.notThrows(() => github.validate());
});

test('github release + uploadAssets', async t => {
  const { GitHub, GitHubApiStub, githubRequestStub } = t.context;

  const remoteUrl = 'https://github.com/webpro/release-it-test';
  const asset = 'file1';
  const version = '2.0.1';
  const tagName = 'v${version}';

  const github = new GitHub({
    release: true,
    releaseNotes: 'echo Custom notes',
    remoteUrl,
    tagName,
    assets: path.resolve('test/resources', asset)
  });

  const releaseResult = await github.release({
    version
  });

  t.is(releaseResult.tag_name, 'v' + version);
  t.is(releaseResult.name, 'Release ' + version);

  const [uploadResult] = await github.uploadAssets();

  t.is(GitHubApiStub.callCount, 1);
  t.deepEqual(GitHubApiStub.firstCall.args[0], {
    version: '3.0.0',
    url: 'https://api.github.com',
    timeout: 0,
    headers: { 'user-agent': 'webpro/release-it' }
  });

  t.is(githubRequestStub.callCount, 2);
  t.is(githubRequestStub.firstCall.lastArg.owner, 'webpro');
  t.is(githubRequestStub.firstCall.lastArg.repo, 'release-it-test');
  t.is(githubRequestStub.firstCall.lastArg.tag_name, 'v2.0.1');
  t.is(githubRequestStub.firstCall.lastArg.name, 'Release 2.0.1');
  t.is(githubRequestStub.firstCall.lastArg.body, 'Custom notes');
  t.is(githubRequestStub.secondCall.lastArg.name, 'file1');

  t.is(uploadResult.name, asset);
  t.is(uploadResult.state, 'uploaded');
  t.is(uploadResult.browser_download_url, `${remoteUrl}/releases/download/v${version}/${asset}`);
});

test('github release (enterprise)', async t => {
  const { GitHub, GitHubApiStub, githubRequestStub } = t.context;

  const github = new GitHub({
    remoteUrl: 'https://github.my-GHE-enabled-company.com/user/repo'
  });

  await github.release({
    version: '1',
    changelog: 'My default changelog'
  });

  t.is(GitHubApiStub.callCount, 1);
  t.is(GitHubApiStub.firstCall.args[0].url, 'https://github.my-GHE-enabled-company.com/api/v3');
  t.is(githubRequestStub.firstCall.lastArg.body, 'My default changelog');
});

test('github release (override host)', async t => {
  const { GitHub, GitHubApiStub } = t.context;

  const github = new GitHub({
    remoteUrl: 'https://github.my-GHE-enabled-company.com/user/repo',
    host: 'my-custom-host.org'
  });

  await github.release({
    version: '1'
  });

  t.is(GitHubApiStub.callCount, 1);
  t.is(GitHubApiStub.firstCall.args[0].url, 'https://my-custom-host.org/api/v3');
});

test('github client non-retry error', async t => {
  const { GitHub, gitHubApi } = t.context;
  const stub = sinon.stub(gitHubApi.repos, 'createRelease');
  stub.throws(new HttpError('Not found', 404));
  const github = new GitHub({ release: true, remoteUrl: '' });
  await t.throwsAsync(github.release({}), { instanceOf: GitHubClientError, message: '404 (Not found)' });
  t.is(stub.callCount, 1);
  stub.restore();
});

test('github client error', async t => {
  const { GitHub, gitHubApi } = t.context;
  const stub = sinon.stub(gitHubApi.repos, 'createRelease');
  stub.throws(new HttpError('Request failed', 500));
  const github = new GitHub({ release: true, remoteUrl: '', retryMinTimeout: 0 });
  await t.throwsAsync(github.release({}), { instanceOf: GitHubClientError, message: '500 (Request failed)' });
  t.is(stub.callCount, 3);
  stub.restore();
});
