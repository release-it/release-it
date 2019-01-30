const path = require('path');
const test = require('ava');
const sinon = require('sinon');
const proxyquire = require('proxyquire');
const GitHubApi = require('@octokit/rest');
const GitHub = require('../lib/plugin/github/GitHub');
const githubRequest = require('./stub/github.request');
const { factory, runTasks } = require('./util');
const { GitHubClientError } = require('../lib/errors');
const HttpError = require('@octokit/request/lib/http-error');
const pkg = require('../package.json');

const tokenRef = 'GITLAB_TOKEN';

test.beforeEach(t => {
  const gitHubApi = new GitHubApi();
  const GitHubApiStub = sinon.stub().returns(gitHubApi);
  const githubRequestStub = sinon.stub().callsFake(githubRequest);
  gitHubApi.hook.wrap('request', githubRequestStub);
  t.context.gitHubApi = gitHubApi;
  t.context.githubRequestStub = githubRequestStub;
  t.context.GitHubApiStub = GitHubApiStub;
  t.context.GitHub = proxyquire('../lib/plugin/github/GitHub', {
    '@octokit/rest': GitHubApiStub
  });
});

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
  const { GitHub, GitHubApiStub, githubRequestStub } = t.context;

  const asset = 'file1';
  const version = '2.0.1';
  const tagName = 'v${version}';

  const options = {
    git: {
      tagName
    },
    github: {
      tokenRef,
      release: true,
      releaseName: 'Release ${version}',
      releaseNotes: 'echo Custom notes',
      assets: path.resolve('test/resources', asset)
    }
  };
  const github = factory(GitHub, { options });
  await github.init();
  await github.beforeRelease();
  github.bump(version);
  const attempt = await github.uploadAssets();

  t.falsy(github.isReleased);
  t.is(attempt, undefined);
  t.is(githubRequestStub.callCount, 0);

  const releaseResult = await github.createRelease({ version });

  t.is(github.isReleased, true);
  t.is(github.getReleaseUrl(), 'https://github.com/release-it/release-it/releases/tag/v2.0.1');

  t.is(releaseResult.tag_name, 'v' + version);
  t.is(releaseResult.name, 'Release ' + version);
  t.is(githubRequestStub.callCount, 1);
  t.is(githubRequestStub.firstCall.lastArg.owner, 'release-it');
  t.is(githubRequestStub.firstCall.lastArg.repo, 'release-it');
  t.is(githubRequestStub.firstCall.lastArg.tag_name, 'v2.0.1');
  t.is(githubRequestStub.firstCall.lastArg.name, 'Release 2.0.1');
  t.is(githubRequestStub.firstCall.lastArg.body, 'Custom notes');

  const [upload] = await github.uploadAssets();

  t.is(GitHubApiStub.callCount, 1);
  t.deepEqual(GitHubApiStub.firstCall.args[0], {
    baseUrl: 'https://api.github.com',
    auth: `token ${github.token}`,
    userAgent: `release-it/${pkg.version}`,
    request: { timeout: undefined }
  });

  t.is(githubRequestStub.callCount, 2);
  t.is(githubRequestStub.secondCall.lastArg.name, 'file1');

  t.is(upload.name, asset);
  t.is(upload.state, 'uploaded');
  t.is(upload.browser_download_url, `https://github.com/release-it/release-it/releases/download/v${version}/${asset}`);
});

test.serial('should release to enterprise host', async t => {
  const { GitHub, GitHubApiStub } = t.context;
  const github = factory(GitHub, { options: { github: { tokenRef } } });
  const exec = sinon.stub(github.shell, 'exec').callThrough();
  exec.withArgs('git config --get remote.origin.url').resolves('https://github.example.org/webpro/release-it');
  await runTasks(github);
  t.is(GitHubApiStub.callCount, 1);
  t.is(GitHubApiStub.firstCall.args[0].baseUrl, 'https://github.example.org/api/v3');
  exec.restore();
});

test('should release to alternative host and proxy', async t => {
  const { GitHub, GitHubApiStub } = t.context;
  const options = { github: { tokenRef, host: 'my-custom-host.org', proxy: 'http://proxy:8080' } };
  const github = factory(GitHub, { options });
  await runTasks(github);
  t.is(GitHubApiStub.callCount, 1);
  t.is(GitHubApiStub.firstCall.args[0].baseUrl, 'https://my-custom-host.org/api/v3');
  t.is(GitHubApiStub.firstCall.args[0].proxy, 'http://proxy:8080');
});

test('should handle octokit client error (without retries)', async t => {
  const { GitHub, gitHubApi } = t.context;
  const stub = sinon.stub(gitHubApi.repos, 'createRelease');
  stub.throws(new HttpError('Not found', 404, null, { url: '', headers: {} }));
  const github = factory(GitHub, { options: { github: { tokenRef } } });
  await t.throwsAsync(runTasks(github), { instanceOf: GitHubClientError, message: '404 (Not found)' });
  t.is(stub.callCount, 1);
  stub.restore();
});

test('should handle octokit client error (with retries)', async t => {
  const { GitHub, gitHubApi } = t.context;
  const stub = sinon.stub(gitHubApi.repos, 'createRelease');
  stub.throws(new HttpError('Request failed', 500, null, { url: '', headers: {} }));
  const options = { github: { tokenRef, retryMinTimeout: 0 } };
  const github = factory(GitHub, { options });
  await t.throwsAsync(runTasks(github), { instanceOf: GitHubClientError, message: '500 (Request failed)' });
  t.is(stub.callCount, 3);
  stub.restore();
});

test('should not call octokit client in dry run', async t => {
  const { GitHub, GitHubApiStub, githubRequestStub } = t.context;

  const options = { git: { tagName: 'v${version}' }, github: { tokenRef, releaseName: 'R ${version}', assets: ['*'] } };
  const github = factory(GitHub, { options, global: { isDryRun: true } });
  sinon.stub(github, 'getLatestVersion').resolves('1.0.0');

  const spy = sinon.spy(github, 'uploadAsset');

  await runTasks(github);

  t.is(GitHubApiStub.callCount, 0);
  t.is(githubRequestStub.callCount, 0);
  t.is(spy.callCount, 0);
  t.is(github.log.exec.args[2][0], 'octokit releases#createRelease "R 1.0.1" (v1.0.1)');
  t.is(github.log.exec.lastCall.args[0], 'octokit releases#uploadAssets');
  t.is(github.getReleaseUrl(), 'https://github.com/release-it/release-it/releases/tag/v1.0.1');
  t.is(github.isReleased, true);

  spy.restore();
});
