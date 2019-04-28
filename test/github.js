const path = require('path');
const test = require('ava');
const sinon = require('sinon');
const proxyquire = require('proxyquire');
const GitHubApi = require('@octokit/rest');
const GitHub = require('../lib/github');
const Log = require('../lib/log');
const githubRequest = require('./stub/github.request');
const { GitHubClientError } = require('../lib/errors');
const HttpError = require('@octokit/request/lib/http-error');
const pkg = require('../package.json');

test.beforeEach(t => {
  const gitHubApi = new GitHubApi();
  const GitHubApiStub = sinon.stub().returns(gitHubApi);
  const githubRequestStub = sinon.stub().callsFake(githubRequest);
  gitHubApi.hook.wrap('request', githubRequestStub);
  t.context.gitHubApi = gitHubApi;
  t.context.githubRequestStub = githubRequestStub;
  t.context.GitHubApiStub = GitHubApiStub;
  t.context.GitHub = proxyquire('../lib/github', {
    '@octokit/rest': GitHubApiStub
  });
});

test('should validate token', t => {
  const tokenRef = 'MY_GITHUB_TOKEN';
  const github = new GitHub({ release: true, tokenRef, remoteUrl: '' });
  delete process.env[tokenRef];
  t.throws(() => github.validate(), /Environment variable "MY_GITHUB_TOKEN" is required for GitHub releases/);
  process.env[tokenRef] = '123';
  t.notThrows(() => github.validate());
});

test('should release and upload assets', async t => {
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

  const attempt = await github.uploadAssets();

  t.falsy(github.isReleased);
  t.is(attempt, undefined);
  t.is(githubRequestStub.callCount, 0);

  const releaseResult = await github.release({
    version
  });

  t.is(releaseResult.tag_name, 'v' + version);
  t.is(releaseResult.name, 'Release ' + version);

  const github2 = new GitHub({
    release: true,
    releaseNotes: 'echo Custom notes',
    remoteUrl,
    tagName,
    assets: path.resolve('test/resources', asset)
  });

  const publishedResult = await github2.maybePublishRelease({
    draft: false
  });

  t.is(github.isReleased, true);
  t.is(github.getReleaseUrl(), 'https://github.com/webpro/release-it-test/releases/tag/v2.0.1');

  t.is(publishedResult.tag_name, 'v' + version);
  t.is(publishedResult.name, 'Release ' + version);
  t.is(githubRequestStub.callCount, 2);
  t.is(githubRequestStub.firstCall.lastArg.owner, 'webpro');
  t.is(githubRequestStub.firstCall.lastArg.repo, 'release-it-test');
  t.is(githubRequestStub.firstCall.lastArg.tag_name, 'v2.0.1');
  t.is(githubRequestStub.firstCall.lastArg.name, 'Release 2.0.1');
  t.is(githubRequestStub.firstCall.lastArg.body, 'Custom notes');

  const [uploadResult] = await github.uploadAssets();

  t.is(GitHubApiStub.callCount, 2);
  t.deepEqual(GitHubApiStub.firstCall.args[0], {
    baseUrl: 'https://api.github.com',
    auth: `token ${github.token}`,
    userAgent: `release-it/${pkg.version}`,
    request: { timeout: 0 }
  });

  t.is(githubRequestStub.callCount, 3);
  t.is(githubRequestStub.thirdCall.lastArg.name, 'file1');

  t.is(uploadResult.name, asset);
  t.is(uploadResult.state, 'uploaded');
  t.is(uploadResult.browser_download_url, `${remoteUrl}/releases/download/v${version}/${asset}`);
});

test('should release to enterprise host', async t => {
  const { GitHub, GitHubApiStub, githubRequestStub } = t.context;

  const github = new GitHub({
    remoteUrl: 'https://github.my-GHE-enabled-company.com/user/repo'
  });

  await github.release({
    version: '1',
    changelog: 'My default changelog'
  });

  t.is(GitHubApiStub.callCount, 1);
  t.is(GitHubApiStub.firstCall.args[0].baseUrl, 'https://github.my-GHE-enabled-company.com/api/v3');
  t.is(githubRequestStub.firstCall.lastArg.body, 'My default changelog');
});

test('should release to alternative host and proxy', async t => {
  const { GitHub, GitHubApiStub } = t.context;

  const github = new GitHub({
    remoteUrl: 'https://github.my-GHE-enabled-company.com/user/repo',
    host: 'my-custom-host.org',
    proxy: 'http://proxy:8080'
  });

  await github.release();

  t.is(GitHubApiStub.callCount, 1);
  t.is(GitHubApiStub.firstCall.args[0].baseUrl, 'https://my-custom-host.org/api/v3');
  t.is(GitHubApiStub.firstCall.args[0].proxy, 'http://proxy:8080');
});

test('should handle octokit client error (without retries)', async t => {
  const { GitHub, gitHubApi } = t.context;
  const stub = sinon.stub(gitHubApi.repos, 'createRelease');
  stub.throws(new HttpError('Not found', 404, null, { url: '', headers: {} }));
  const github = new GitHub({ release: true, remoteUrl: '' });
  await t.throwsAsync(github.release(), { instanceOf: GitHubClientError, message: '404 (Not found)' });
  t.is(stub.callCount, 1);
  stub.restore();
});

test('should handle octokit client error (with retries)', async t => {
  const { GitHub, gitHubApi } = t.context;
  const stub = sinon.stub(gitHubApi.repos, 'createRelease');
  stub.throws(new HttpError('Request failed', 500, null, { url: '', headers: {} }));
  const github = new GitHub({ release: true, remoteUrl: '', retryMinTimeout: 0 });
  await t.throwsAsync(github.release(), { instanceOf: GitHubClientError, message: '500 (Request failed)' });
  t.is(stub.callCount, 3);
  stub.restore();
});

test('should not call octokit client in dry run', async t => {
  const { GitHub, GitHubApiStub, githubRequestStub } = t.context;
  const log = sinon.createStubInstance(Log);

  const github = new GitHub({
    remoteUrl: 'https://example.org/owner/repo',
    tagName: 'v${version}',
    assets: ['*'],
    isDryRun: true,
    log
  });

  const spy = sinon.spy(github, 'uploadAsset');

  await github.release({
    version: '1'
  });

  t.is(GitHubApiStub.callCount, 0);
  t.is(githubRequestStub.callCount, 0);
  t.is(log.exec.callCount, 1);
  t.is(github.getReleaseUrl(), 'https://example.org/owner/repo/releases/tag/v1');
  t.is(github.isReleased, true);

  await github.uploadAssets();

  t.is(log.exec.callCount, 2);
  t.is(GitHubApiStub.callCount, 0);
  t.is(githubRequestStub.callCount, 0);
  t.is(spy.callCount, 0);

  spy.restore();
});
