const test = require('ava');
const sinon = require('sinon');
const nock = require('nock');
const { interceptPublish, interceptAsset } = require('./stub/gitlab');
const GitLab = require('../lib/plugin/gitlab/GitLab');
const { factory, runTasks } = require('./util');

const tokenRef = 'GITLAB_TOKEN';

test('should validate token', async t => {
  const tokenRef = 'MY_GITLAB_TOKEN';
  const options = { gitlab: { release: true, tokenRef } };
  const gitlab = factory(GitLab, { options });
  delete process.env[tokenRef];

  await t.throwsAsync(gitlab.init(), /Environment variable "MY_GITLAB_TOKEN" is required for GitLab releases/);
  process.env[tokenRef] = '123'; // eslint-disable-line require-atomic-updates
  await t.notThrowsAsync(gitlab.init());
});

test('should upload assets and release', async t => {
  const remoteUrl = 'https://gitlab.com/user/repo';
  const asset = 'file1';
  const options = {
    git: { remoteUrl },
    gitlab: {
      tokenRef,
      release: true,
      releaseName: 'Release ${version}',
      releaseNotes: 'echo Custom notes',
      assets: `test/resources/${asset}`
    }
  };
  const gitlab = factory(GitLab, { options });
  sinon.stub(gitlab, 'getLatestVersion').resolves('2.0.0');

  interceptAsset();
  interceptPublish({
    body: {
      name: 'Release 2.0.1',
      tag_name: '2.0.1',
      description: 'Custom notes',
      assets: {
        links: [
          {
            name: asset,
            url: `${remoteUrl}/uploads/7e8bec1fe27cc46a4bc6a91b9e82a07c/${asset}`
          }
        ]
      }
    }
  });

  await runTasks(gitlab);

  t.is(gitlab.assets[0].url, `${remoteUrl}/uploads/7e8bec1fe27cc46a4bc6a91b9e82a07c/${asset}`);
  t.is(gitlab.getReleaseUrl(), `${remoteUrl}/releases`);
  t.is(gitlab.isReleased, true);
});

test('should release to self-managed host', async t => {
  const scope = nock('https://gitlab.example.org');
  scope.post('/api/v4/projects/user%2Frepo/releases').reply(200, {});
  const options = {
    git: { remoteUrl: `https://gitlab.example.org/user/repo`, tagName: '${version}' },
    gitlab: { releaseName: 'Release ${version}', releaseNotes: 'echo readme', tokenRef }
  };
  const gitlab = factory(GitLab, { options });
  sinon.stub(gitlab, 'getLatestVersion').resolves('1.0.0');

  await runTasks(gitlab);

  t.is(gitlab.origin, 'https://gitlab.example.org');
  t.is(gitlab.baseUrl, 'https://gitlab.example.org/api/v4');
});

test('should release to sub-grouped repo', async t => {
  const scope = nock('https://gitlab.com');
  scope.post('/api/v4/projects/group%2Fsub-group%2Frepo/releases').reply(200, {});
  const options = { gitlab: { tokenRef }, git: { remoteUrl: 'git@gitlab.com:group/sub-group/repo.git' } };
  const gitlab = factory(GitLab, { options });

  await runTasks(gitlab);

  t.is(gitlab.getReleaseUrl(), `https://gitlab.com/group/sub-group/repo/releases`);
  t.is(gitlab.isReleased, true);
});

test('should handle (http) error and use fallback tag release', async t => {
  const [host, owner, repo] = ['https://gitlab.example.org', 'legacy', 'repo'];
  const remoteUrl = `${host}/${owner}/${repo}`;
  const scope = nock(host);
  scope.post(`/api/v4/projects/legacy%2Frepo/releases`).reply(404);
  scope.post(`/api/v4/projects/legacy%2Frepo/repository/tags/1.0.1/release`).reply(200, {});
  const options = { git: { remoteUrl }, gitlab: { release: true, retryMinTimeout: 0, tokenRef } };
  const gitlab = factory(GitLab, { options });
  sinon.stub(gitlab, 'getLatestVersion').resolves('1.0.0');

  await runTasks(gitlab);

  t.is(gitlab.getReleaseUrl(), `${remoteUrl}/tags/1.0.1`);
  t.is(gitlab.isReleased, true);
});

test('should not make requests in dry run', async t => {
  const [host, owner, repo] = ['https://gitlab.example.org', 'user', 'repo'];
  const remoteUrl = `${host}/${owner}/${repo}`;
  const options = { git: { remoteUrl }, gitlab: { releaseName: 'R', tokenRef } };
  const gitlab = factory(GitLab, { options, global: { isDryRun: true } });
  sinon.stub(gitlab, 'getLatestVersion').resolves('1.0.0');
  const spy = sinon.spy(gitlab, 'client', ['get']);

  await runTasks(gitlab);

  t.is(spy.get.callCount, 0);
  t.is(gitlab.log.exec.args[1][0], 'gitlab releases#uploadAssets');
  t.is(gitlab.log.exec.args[2][0], 'gitlab releases#createRelease "R" (1.0.1)');
  t.is(gitlab.getReleaseUrl(), `${remoteUrl}/releases`);
  t.is(gitlab.isReleased, true);
  spy.restore();
});
