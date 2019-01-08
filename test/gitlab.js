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

test('should validate token', async t => {
  const { GitLab } = t.context;
  const tokenRef = 'MY_GITHUB_TOKEN';
  const gitlab = new GitLab({ release: true, tokenRef, remoteUrl: '' });
  delete process.env[tokenRef];
  t.throws(() => gitlab.validate(), /Environment variable "MY_GITHUB_TOKEN" is required for GitLab releases/);
  process.env[tokenRef] = '123';
  t.notThrows(() => gitlab.validate());
});

test('should release', async t => {
  const { GitLab, gotStub } = t.context;

  const remoteUrl = 'https://gitlab.com/webpro/release-it-test';
  const version = '2.0.1';
  const tagName = 'v${version}';

  const gitlab = new GitLab({
    release: true,
    releaseNotes: 'echo Custom notes',
    remoteUrl,
    tagName
  });

  const releaseResult = await gitlab.release({
    version
  });

  t.is(releaseResult.tag_name, '');
  t.is(releaseResult.description, '');
  t.is(gitlab.releaseUrl, 'https://gitlab.com/webpro/release-it-test/tags/v2.0.1');
  t.is(gitlab.isReleased, true);

  const url = 'https://gitlab.com/api/v4/projects/webpro%2Frelease-it-test/repository/tags/v2.0.1/release';
  t.is(gotStub.callCount, 1);
  t.is(gotStub.firstCall.args[0], url);
  t.deepEqual(gotStub.firstCall.args[1].body, {
    description: 'Custom notes'
  });
});

test('should release to self-managed host', async t => {
  const { GitLab, gotStub } = t.context;

  const gitlab = new GitLab({
    remoteUrl: 'https://gitlab.example.org/user/repo',
    tagName: '${version}'
  });

  await gitlab.release({
    version: '1',
    changelog: 'My default changelog'
  });

  const url = 'https://gitlab.example.org/api/v4/projects/user%2Frepo/repository/tags/1/release';
  t.is(gotStub.callCount, 1);
  t.is(gotStub.firstCall.args[0], url);
  t.deepEqual(gotStub.firstCall.args[1].body, {
    description: 'My default changelog'
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
  t.is(log.dry.callCount, 1);
  t.is(gitlab.getReleaseUrl(), 'https://example.org/owner/repo/tags/v1');
  t.is(gitlab.isReleased, true);
});
