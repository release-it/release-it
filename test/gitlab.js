const test = require('tape');
const sinon = require('sinon');
const proxyquire = require('proxyquire');

const gotStub = sinon.stub().resolves({
  body: {
    tag_name: '',
    description: ''
  }
});

const GitLab = proxyquire('../lib/gitlab', {
  got: gotStub
});

test('validate', async t => {
  const tokenRef = 'MY_GITHUB_TOKEN';
  const gitlab = new GitLab({ release: true, tokenRef, remoteUrl: '' });
  delete process.env[tokenRef];
  t.throws(() => gitlab.validate(), /Environment variable "MY_GITHUB_TOKEN" is required for GitLab releases/);
  process.env[tokenRef] = '123';
  t.doesNotThrow(() => gitlab.validate());
  t.end();
});

test('gitlab release', async t => {
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

  t.equal(releaseResult.tag_name, '');
  t.equal(releaseResult.description, '');
  t.equal(gitlab.releaseUrl, 'https://gitlab.com/webpro/release-it-test/tags/v2.0.1');
  t.equal(gitlab.isReleased, true);

  const url = 'https://gitlab.com/api/v4/projects/webpro%2Frelease-it-test/repository/tags/v2.0.1/release';
  t.equal(gotStub.callCount, 1);
  t.equal(gotStub.firstCall.args[0], url);
  t.deepEqual(gotStub.firstCall.args[1].body, {
    description: 'Custom notes'
  });

  gotStub.resetHistory();
  t.end();
});

test('gitlab release (self-managed)', async t => {
  const gitlab = new GitLab({
    remoteUrl: 'https://gitlab.example.org/user/repo',
    tagName: '${version}'
  });

  await gitlab.release({
    version: '1',
    changelog: 'My default changelog'
  });

  const url = 'https://gitlab.example.org/api/v4/projects/user%2Frepo/repository/tags/1/release';
  t.equal(gotStub.callCount, 1);
  t.equal(gotStub.firstCall.args[0], url);
  t.deepEqual(gotStub.firstCall.args[1].body, {
    description: 'My default changelog'
  });

  gotStub.resetHistory();
  t.end();
});

test('http error', async t => {
  gotStub.throws(new Error('Not found'));

  const remoteUrl = 'https://gitlab.com/webpro/release-it-test';
  const version = '2.0.1';
  const tagName = 'v${version}';

  const gitlab = new GitLab({
    release: true,
    remoteUrl,
    tagName
  });

  try {
    await gitlab.release({ version });
  } catch (err) {
    t.ok(err instanceof Error);
    t.equal(err.message, 'Not found');
  }

  gotStub.resetHistory();
  t.end();
});
