const path = require('path');
const test = require('tape');
const sinon = require('sinon');
const proxyquire = require('proxyquire');
const GitHubApi = require('@octokit/rest');
const githubRequestMock = require('./mock/github.request');
const { GitHubClientError } = require('../lib/errors');

const githubRequestStub = sinon.stub().callsFake(githubRequestMock);
const githubApi = new GitHubApi();
githubApi.hook.wrap('request', githubRequestStub);
const GitHubApiStub = sinon.stub().returns(githubApi);

const GitHub = proxyquire('../lib/github', {
  '@octokit/rest': GitHubApiStub
});

test('github validate', async t => {
  const tokenRef = 'MY_GITHUB_TOKEN';
  const github = new GitHub({ release: true, tokenRef, remoteUrl: '' });
  delete process.env[tokenRef];
  t.throws(() => github.validate(), /Environment variable "MY_GITHUB_TOKEN" is required for GitHub releases/);
  process.env[tokenRef] = '123';
  t.doesNotThrow(() => github.validate());
  t.end();
});

test('github release + uploadAssets', async t => {
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

  t.equal(releaseResult.tag_name, 'v' + version);
  t.equal(releaseResult.name, 'Release ' + version);

  const [uploadResult] = await github.uploadAssets();

  t.equal(GitHubApiStub.callCount, 1);
  t.deepEqual(GitHubApiStub.firstCall.args[0], {
    version: '3.0.0',
    url: 'https://api.github.com',
    timeout: 0,
    headers: { 'user-agent': 'webpro/release-it' }
  });

  t.equal(githubRequestStub.callCount, 2);
  t.equal(githubRequestStub.firstCall.lastArg.owner, 'webpro');
  t.equal(githubRequestStub.firstCall.lastArg.repo, 'release-it-test');
  t.equal(githubRequestStub.firstCall.lastArg.tag_name, 'v2.0.1');
  t.equal(githubRequestStub.firstCall.lastArg.name, 'Release 2.0.1');
  t.equal(githubRequestStub.firstCall.lastArg.body, 'Custom notes');
  t.equal(githubRequestStub.secondCall.lastArg.name, 'file1');

  t.equal(uploadResult.name, asset);
  t.equal(uploadResult.state, 'uploaded');
  t.equal(uploadResult.browser_download_url, `${remoteUrl}/releases/download/v${version}/${asset}`);

  GitHubApiStub.resetHistory();
  githubRequestStub.resetHistory();
  t.end();
});

test('github release (enterprise)', async t => {
  const github = new GitHub({
    remoteUrl: 'https://github.my-GHE-enabled-company.com/user/repo'
  });

  await github.release({
    version: '1',
    changelog: 'My default changelog'
  });

  t.equal(GitHubApiStub.callCount, 1);
  t.equal(GitHubApiStub.firstCall.args[0].url, 'https://github.my-GHE-enabled-company.com/api/v3');
  t.equal(githubRequestStub.firstCall.lastArg.body, 'My default changelog');

  GitHubApiStub.resetHistory();
  githubRequestStub.resetHistory();
  t.end();
});

test('github release (override host)', async t => {
  const github = new GitHub({
    remoteUrl: 'https://github.my-GHE-enabled-company.com/user/repo',
    host: 'my-custom-host.org'
  });

  await github.release({
    version: '1'
  });

  t.equal(GitHubApiStub.callCount, 1);
  t.equal(GitHubApiStub.firstCall.args[0].url, 'https://my-custom-host.org/api/v3');

  GitHubApiStub.resetHistory();
  t.end();
});

test('github client error', async t => {
  const stub = sinon.stub(githubApi.repos, 'createRelease');
  const githubErr = new Error('Not found');
  githubErr.status = 404;
  stub.throws(githubErr);

  const remoteUrl = 'https://github.com/webpro/release-it-test';
  const version = '2.0.1';
  const tagName = 'v${version}';

  const github = new GitHub({
    release: true,
    remoteUrl,
    tagName
  });

  try {
    await github.release({ version });
  } catch (err) {
    t.ok(err instanceof GitHubClientError);
    t.equal(err.message, '404 (Not found)');
  }

  GitHubApiStub.resetHistory();
  githubRequestStub.resetHistory();
  t.end();
});
