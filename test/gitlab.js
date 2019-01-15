const path = require('path');
const test = require('ava');
const sinon = require('sinon');
const proxyquire = require('proxyquire');
const Log = require('../lib/log');

const response = {
  body: {
    tag_name: '',
    description: ''
  }
};

test.beforeEach(t => {
  t.context.gotStub = sinon.stub().resolves(response);
  t.context.GitLab = proxyquire('../lib/gitlab', {
    got: t.context.gotStub
  });
});

test('should validate token', t => {
  const { GitLab } = t.context;
  const tokenRef = 'MY_GITHUB_TOKEN';
  const gitlab = new GitLab({ release: true, tokenRef, remoteUrl: '' });
  delete process.env[tokenRef];
  t.throws(() => gitlab.validate(), /Environment variable "MY_GITHUB_TOKEN" is required for GitLab releases/);
  process.env[tokenRef] = '123';
  t.notThrows(() => gitlab.validate());
});

test('should upload assets and release', async t => {
  const { GitLab, gotStub } = t.context;
  gotStub.onFirstCall().resolves({
    body: JSON.stringify({
      alt: 'file1',
      url: '/uploads/7e8bec1fe27cc46a4bc6a91b9e82a07c/file1',
      markdown: '[file1](/uploads/7e8bec1fe27cc46a4bc6a91b9e82a07c/file1)'
    })
  });
  gotStub.onSecondCall().resolves({ body: { tag_name: 'v2.0.1', description: '-', name: 'Release 2.0.1' } });

  const remoteUrl = 'https://gitlab.com/webpro/release-it-test';
  const asset = 'file1';
  const version = '2.0.1';
  const tagName = 'v${version}';

  const gitlab = new GitLab({
    release: true,
    releaseNotes: 'echo Custom notes',
    remoteUrl,
    tagName,
    assets: path.resolve('test/resources', asset)
  });

  const [uploadResult] = await gitlab.uploadAssets();
  t.is(uploadResult.url, 'https://gitlab.com/webpro/release-it-test/uploads/7e8bec1fe27cc46a4bc6a91b9e82a07c/file1');

  const releaseResult = await gitlab.release({
    version
  });

  t.is(releaseResult.tag_name, 'v2.0.1');
  t.is(releaseResult.description, '-');
  t.is(gitlab.releaseUrl, 'https://gitlab.com/webpro/release-it-test/releases');
  t.is(gitlab.isReleased, true);

  t.is(gotStub.callCount, 2);
  t.is(gotStub.firstCall.args[0], 'https://gitlab.com/api/v4/projects/webpro%2Frelease-it-test/uploads');
  t.is(gotStub.secondCall.args[0], 'https://gitlab.com/api/v4/projects/webpro%2Frelease-it-test/releases');
  t.deepEqual(gotStub.secondCall.args[1].body, {
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
  const { GitLab, gotStub } = t.context;
  gotStub.onFirstCall().resolves({});
  gotStub.onSecondCall().resolves({});

  const gitlab = new GitLab({
    remoteUrl: 'https://gitlab.example.org/user/repo',
    tagName: '${version}'
  });

  await gitlab.release({
    version: '1',
    changelog: 'My default changelog'
  });

  const url = 'https://gitlab.example.org/api/v4/projects/user%2Frepo/releases';
  t.is(gotStub.callCount, 1);
  t.is(gotStub.firstCall.args[0], url);
  t.deepEqual(gotStub.firstCall.args[1].body, {
    description: 'My default changelog',
    name: 'Release 1',
    tag_name: '1'
  });
});

test('should handle (http) error', async t => {
  const { GitLab, gotStub } = t.context;
  gotStub.throws(new Error('Not found'));
  const gitlab = new GitLab({ release: true, remoteUrl: '', retryMinTimeout: 0 });
  await t.throwsAsync(gitlab.release(), { instanceOf: Error, message: 'Not found' });
});

test('should not make requests in dry run', async t => {
  const { GitLab, gotStub } = t.context;
  const log = sinon.createStubInstance(Log);

  const gitlab = new GitLab({
    remoteUrl: 'https://example.org/owner/repo',
    tagName: 'v${version}',
    isDryRun: true,
    log
  });

  await gitlab.release({
    version: '1'
  });

  t.is(gotStub.callCount, 0);
  t.is(log.exec.callCount, 1);
  t.is(gitlab.getReleaseUrl(), 'https://example.org/owner/repo/releases');
  t.is(gitlab.isReleased, true);
});

test('should use fallback tag release', async t => {
  const { GitLab, gotStub } = t.context;
  const log = sinon.createStubInstance(Log);
  const err = new Error();
  err.statusCode = 404;
  gotStub.onFirstCall().rejects(err);
  gotStub.onSecondCall().resolves({});

  const gitlab = new GitLab({
    remoteUrl: 'https://example.org/owner/repo',
    tagName: 'v${version}',
    log
  });

  await gitlab.release({
    version: '1'
  });

  t.is(gotStub.callCount, 2);
  t.is(gotStub.firstCall.args[0], 'https://example.org/api/v4/projects/owner%2Frepo/releases');
  t.is(gotStub.secondCall.args[0], 'https://example.org/api/v4/projects/owner%2Frepo/repository/tags/v1/release');
  t.is(log.exec.callCount, 2);
  t.is(gitlab.getReleaseUrl(), 'https://example.org/owner/repo/tags/v1');
  t.is(gitlab.isReleased, true);
});
