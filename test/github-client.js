const test = require('tape');
const sinon = require('sinon');
const proxyquire = require('proxyquire');
const shell = require('shelljs');
const repoPathParse = require('parse-repo');
const GitHubApi = require('./mock/github');

const GitHubApiStub = sinon.stub().returns(new GitHubApi());

const { release, uploadAssets } = proxyquire('../lib/github-client', {
  github: GitHubApiStub
});

test('release + uploadAssets', async t => {
  const dir = 'test/resources';
  shell.pushd('-q', dir);

  const remoteUrl = 'https://github.com/webpro/release-it-test';
  const asset = 'file1';
  const version = '2.0.1';
  const changelog = '';
  const tagName = 'v%s';
  const repo = repoPathParse(remoteUrl);
  const github = {
    releaseName: 'Release %s',
    preRelease: false,
    draft: false,
    assets: asset,
    token: 'fake token'
  };

  const releaseResult = await release({
    version,
    tagName,
    repo,
    changelog,
    github
  });

  t.equal(releaseResult.tag_name, 'v' + version);
  t.equal(releaseResult.name, 'Release ' + version);

  const [uploadResult] = await uploadAssets({ release: releaseResult, repo, github });

  t.equal(uploadResult.name, asset);
  t.equal(uploadResult.state, 'uploaded');
  t.equal(uploadResult.browser_download_url, `${remoteUrl}/releases/download/v${version}/${asset}`);

  t.equal(GitHubApiStub.callCount, 1);
  t.deepEqual(GitHubApiStub.firstCall.args[0], {
    version: '3.0.0',
    protocol: 'https',
    host: '',
    pathPrefix: '',
    timeout: 10000,
    headers: { 'user-agent': 'webpro/release-it' }
  });

  shell.popd('-q');
  GitHubApiStub.resetHistory();
  t.end();
});

test('release + uploadAssets (enterprise)', async t => {
  await release({
    repo: repoPathParse('https://github.my-GHE-enabled-company.com/user/repo'),
    github: {}
  });

  t.equal(GitHubApiStub.callCount, 1);
  t.equal(GitHubApiStub.firstCall.args[0].host, 'github.my-GHE-enabled-company.com');
  t.equal(GitHubApiStub.firstCall.args[0].pathPrefix, '/api/v3');

  GitHubApiStub.resetHistory();
  t.end();
});

test('release + uploadAssets (override host)', async t => {
  await release({
    repo: repoPathParse('https://github.my-GHE-enabled-company.com/user/repo'),
    github: {
      host: 'my-custom-host.org'
    }
  });

  t.equal(GitHubApiStub.callCount, 1);
  t.equal(GitHubApiStub.firstCall.args[0].host, 'my-custom-host.org');
  t.equal(GitHubApiStub.firstCall.args[0].pathPrefix, '/api/v3');

  GitHubApiStub.resetHistory();
  t.end();
});
