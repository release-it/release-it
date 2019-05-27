const path = require('path');
const test = require('ava');
const sinon = require('sinon');
const proxyquire = require('proxyquire');
const GitLab = require('../lib/plugin/gitlab/GitLab');
const { factory, runTasks } = require('./util');
const Log = require('../lib/log');
const got = require('./stub/got');
const globalTunnel = require('global-tunnel-ng');

const tokenRef = 'GITLAB_TOKEN';
const remoteUrl = 'https://gitlab.example.org/owner/repo';

test.beforeEach(t => {
  t.context.got = got();
  t.context.GitLab = proxyquire('../lib/plugin/gitlab/GitLab', {
    got: t.context.got
  });
});

test('should validate token', async t => {
  const tokenRef = 'MY_GITLAB_TOKEN';
  const options = { gitlab: { release: true, tokenRef } };
  const gitlab = factory(GitLab, { options });
  delete process.env[tokenRef];
  await t.throwsAsync(gitlab.init(), /Environment variable "MY_GITLAB_TOKEN" is required for GitLab releases/);
  process.env[tokenRef] = '123';
  await t.notThrowsAsync(gitlab.init());
});

test('should upload assets and release', async t => {
  const { GitLab, got } = t.context;
  got.post.onFirstCall().resolves({
    body: JSON.stringify({
      alt: 'file1',
      url: '/uploads/7e8bec1fe27cc46a4bc6a91b9e82a07c/file1',
      markdown: '[file1](/uploads/7e8bec1fe27cc46a4bc6a91b9e82a07c/file1)'
    })
  });

  const remoteUrl = 'https://gitlab.com/webpro/release-it-test';
  const asset = 'file1';
  const tagName = 'v${version}';

  const options = {
    git: {
      tagName,
      remoteUrl
    },
    gitlab: {
      tokenRef,
      release: true,
      releaseName: 'Release ${version}',
      releaseNotes: 'echo Custom notes',
      assets: path.resolve('test/resources', asset)
    }
  };

  const gitlab = factory(GitLab, { options });
  sinon.stub(gitlab, 'getLatestVersion').resolves('2.0.0');

  await runTasks(gitlab);

  t.is(
    gitlab.assets[0].url,
    'https://gitlab.com/webpro/release-it-test/uploads/7e8bec1fe27cc46a4bc6a91b9e82a07c/file1'
  );

  t.is(gitlab.getReleaseUrl(), 'https://gitlab.com/webpro/release-it-test/releases');
  t.is(gitlab.isReleased, true);

  t.is(got.post.callCount, 2);
  t.is(got.post.firstCall.args[0], '/projects/webpro%2Frelease-it-test/uploads');
  t.is(got.post.secondCall.args[0], '/projects/webpro%2Frelease-it-test/releases');
  t.deepEqual(got.post.secondCall.args[1].body, {
    description: 'Custom notes',
    name: 'Release 2.0.1',
    tag_name: 'v2.0.1',
    assets: {
      links: [
        {
          url: 'https://gitlab.com/webpro/release-it-test/uploads/7e8bec1fe27cc46a4bc6a91b9e82a07c/file1',
          name: asset
        }
      ]
    }
  });
});

test('should release to self-managed host', async t => {
  const { GitLab, got } = t.context;
  got.post.onFirstCall().resolves({});
  got.post.onSecondCall().resolves({});

  const options = {
    git: { remoteUrl, tagName: '${version}' },
    gitlab: { releaseName: 'Release ${version}', releaseNotes: 'echo readme', tokenRef }
  };
  const gitlab = factory(GitLab, { options });
  sinon.stub(gitlab, 'getLatestVersion').resolves('1.0.0');

  await runTasks(gitlab);

  t.is(gitlab.origin, 'https://gitlab.example.org');
  t.is(gitlab.baseUrl, 'https://gitlab.example.org/api/v4');
  t.is(got.post.callCount, 1);
  t.is(got.post.firstCall.args[0], '/projects/owner%2Frepo/releases');
  t.deepEqual(got.post.firstCall.args[1].body, {
    description: 'readme',
    name: 'Release 1.0.1',
    tag_name: '1.0.1'
  });
});

test('should release through proxy', async t => {
  const { GitLab, got } = t.context;
  got.post.onFirstCall().resolves({});
  got.post.onSecondCall().resolves({});

  const options = { 
    git: { remoteUrl },
    gitlab: { 
      tokenRef, 
      proxy: { host: 'localhost', port: 8080 } 
    }
  };
  const gitlab = factory(GitLab, { options });
  await runTasks(gitlab);
  t.is(got.post.callCount, 1);
  t.is(globalTunnel.isProxying, true);
  t.is(globalTunnel.proxyConfig.host, 'localhost');
  t.is(globalTunnel.proxyConfig.port, 8080);
  globalTunnel.end();
});

test('should release to sub-grouped repo', async t => {
  const { GitLab, got } = t.context;
  const options = { gitlab: { tokenRef }, git: { remoteUrl: 'git@gitlab.com:group/sub-group/repo.git' } };
  const gitlab = factory(GitLab, { options });
  await runTasks(gitlab);
  t.is(got.post.callCount, 1);
  t.is(got.post.firstCall.args[0], '/projects/group%2Fsub-group%2Frepo/releases');
});

test('should handle (http) error', async t => {
  const { GitLab, got } = t.context;
  got.post.throws(new Error('Not found'));
  const options = { git: { remoteUrl: '' }, gitlab: { release: true, retryMinTimeout: 0 } };
  const gitlab = factory(GitLab, { options });
  await t.throwsAsync(gitlab.createRelease(), { instanceOf: Error, message: 'Not found' });
});

test('should not make requests in dry run', async t => {
  const { GitLab, got } = t.context;
  const log = sinon.createStubInstance(Log);
  const gitlab = factory(GitLab, { options: { gitlab: { tokenRef } }, global: { isDryRun: true }, container: { log } });
  await runTasks(gitlab);
  t.is(got.post.callCount, 0);
  t.is(gitlab.isReleased, true);
});

test('should use fallback tag release', async t => {
  const { GitLab, got } = t.context;
  const log = sinon.createStubInstance(Log);
  const err = new Error();
  err.statusCode = 404;
  got.post.onFirstCall().rejects(err);
  got.post.onSecondCall().resolves({});

  const options = { gitlab: { releaseName: 'R ${version}', tokenRef }, git: { remoteUrl, tagName: '${version}' } };
  const gitlab = factory(GitLab, { options, container: { log } });
  sinon.stub(gitlab, 'getLatestVersion').resolves('1.0.0');

  await runTasks(gitlab);

  t.is(got.post.callCount, 2);
  t.is(got.post.firstCall.args[0], '/projects/owner%2Frepo/releases');
  t.is(got.post.secondCall.args[0], '/projects/owner%2Frepo/repository/tags/1.0.1/release');
  t.is(log.exec.lastCall.args[0], 'gitlab releases#addReleaseNotesToTag "R 1.0.1" (1.0.1)');
  t.is(gitlab.getReleaseUrl(), 'https://gitlab.example.org/owner/repo/tags/1.0.1');
  t.is(gitlab.isReleased, true);
});
