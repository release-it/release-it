const path = require('path');
const test = require('tape');
const sinon = require('sinon');
const proxyquire = require('proxyquire');
const sh = require('shelljs');
const GitHubApi = require('./mock/github');

const GitHubApiStub = sinon.stub().returns(new GitHubApi());

const GitHub = proxyquire('../lib/github-client', {
  '@octokit/rest': GitHubApiStub
});

test('validate', async t => {
  const tokenRef = 'MY_GITHUB_TOKEN';
  const github = new GitHub({ release: true, tokenRef, remoteUrl: '' });
  delete process.env[tokenRef];
  t.throws(() => github.validate(), /Environment variable "MY_GITHUB_TOKEN" is required for GitHub releases/);
  process.env[tokenRef] = '123';
  t.doesNotThrow(() => github.validate());
  GitHubApiStub.resetHistory();
  t.end();
});

test('release + uploadAssets', async t => {
  const remoteUrl = 'https://github.com/webpro/release-it-test';
  const asset = 'file1';
  const version = '2.0.1';
  const tagName = 'v${version}';

  const github = new GitHub({
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

  t.equal(uploadResult.name, asset);
  t.equal(uploadResult.state, 'uploaded');
  t.equal(uploadResult.browser_download_url, `${remoteUrl}/releases/download/v${version}/${asset}`);

  t.equal(GitHubApiStub.callCount, 1);
  t.deepEqual(GitHubApiStub.firstCall.args[0], {
    version: '3.0.0',
    url: 'https://api.github.com',
    timeout: 0,
    headers: { 'user-agent': 'webpro/release-it' }
  });

  GitHubApiStub.resetHistory();
  t.end();
});

test('release + uploadAssets (enterprise)', async t => {
  const github = new GitHub({
    remoteUrl: 'https://github.my-GHE-enabled-company.com/user/repo'
  });

  await github.release({
    version: '1'
  });

  t.equal(GitHubApiStub.callCount, 1);
  t.equal(GitHubApiStub.firstCall.args[0].url, 'https://github.my-GHE-enabled-company.com/api/v3');

  GitHubApiStub.resetHistory();
  t.end();
});

test('release + uploadAssets (override host)', async t => {
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
