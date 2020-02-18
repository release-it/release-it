const test = require('ava');
const sinon = require('sinon');
const nock = require('nock');
const GitLab = require('../lib/plugin/gitlab/GitLab');
const { interceptUser, interceptMembers, interceptPublish, interceptAsset } = require('./stub/gitlab');
const { factory, runTasks } = require('./util');

const tokenRef = 'GITLAB_TOKEN';

test.serial('should validate token', async t => {
  const tokenRef = 'MY_GITLAB_TOKEN';
  const remoteUrl = 'https://gitlab.com/user/repo';
  const options = { gitlab: { release: true, tokenRef, remoteUrl } };
  const gitlab = factory(GitLab, { options });
  delete process.env[tokenRef];

  await t.throwsAsync(gitlab.init(), {
    message: /Environment variable "MY_GITLAB_TOKEN" is required for GitLab releases/
  });
  process.env[tokenRef] = '123'; // eslint-disable-line require-atomic-updates

  interceptUser();
  interceptMembers();
  await t.notThrowsAsync(gitlab.init());
});

test.serial('should upload assets and release', async t => {
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

  interceptUser();
  interceptMembers();
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

test.serial('should release to self-managed host', async t => {
  const host = 'https://gitlab.example.org';
  const scope = nock(host);
  scope.post('/api/v4/projects/user%2Frepo/releases').reply(200, {});
  const options = {
    git: { remoteUrl: `${host}/user/repo`, tagName: '${version}' },
    gitlab: { releaseName: 'Release ${version}', releaseNotes: 'echo readme', tokenRef }
  };
  const gitlab = factory(GitLab, { options });
  sinon.stub(gitlab, 'getLatestVersion').resolves('1.0.0');

  interceptUser({ host });
  interceptMembers({ host });

  await runTasks(gitlab);

  t.is(gitlab.origin, host);
  t.is(gitlab.baseUrl, `${host}/api/v4`);
});

test.serial('should release to sub-grouped repo', async t => {
  const scope = nock('https://gitlab.com');
  scope.post('/api/v4/projects/group%2Fsub-group%2Frepo/releases').reply(200, {});
  const options = { gitlab: { tokenRef }, git: { remoteUrl: 'git@gitlab.com:group/sub-group/repo.git' } };
  const gitlab = factory(GitLab, { options });

  interceptUser({ owner: 'sub-group' });
  interceptMembers({ owner: 'sub-group', group: 'group' });

  await runTasks(gitlab);

  t.is(gitlab.getReleaseUrl(), `https://gitlab.com/group/sub-group/repo/releases`);
  t.is(gitlab.isReleased, true);
});

test.serial('should throw for unauthenticated user', async t => {
  const host = 'https://gitlab.com';
  const remoteUrl = `${host}/user/repo`;
  const options = { gitlab: { tokenRef, remoteUrl, host } };
  const gitlab = factory(GitLab, { options });
  const scope = nock(host);
  scope.get(`/api/v4/user`).reply(401);

  await t.throwsAsync(runTasks(gitlab), {
    instanceOf: Error,
    message: 'Could not authenticate with GitLab using environment variable "GITLAB_TOKEN".'
  });
});

test.serial('should throw for non-collaborator', async t => {
  const host = 'https://gitlab.com';
  const remoteUrl = `${host}/john/repo`;
  const options = { gitlab: { tokenRef, remoteUrl, host } };
  const gitlab = factory(GitLab, { options });
  const scope = nock(host);
  scope.get(`/api/v4/projects/john%2Frepo/members`).reply(200, [{ username: 'emma' }]);
  interceptUser({ owner: 'john' });

  await t.throwsAsync(runTasks(gitlab), {
    instanceOf: Error,
    message: 'User john is not a collaborator for john/repo.'
  });
});

test.serial('should throw for insufficient access level', async t => {
  const host = 'https://gitlab.com';
  const remoteUrl = `${host}/john/repo`;
  const options = { gitlab: { tokenRef, remoteUrl, host } };
  const gitlab = factory(GitLab, { options });
  const scope = nock(host);
  scope.get(`/api/v4/projects/john%2Frepo/members`).reply(200, [{ username: 'john', access_level: 10 }]);
  interceptUser({ owner: 'john' });

  await t.throwsAsync(runTasks(gitlab), {
    instanceOf: Error,
    message: 'User john is not a collaborator for john/repo.'
  });
});

test.serial('should handle (http) error and use fallback tag release', async t => {
  const [host, owner, repo] = ['https://gitlab.example.org', 'legacy', 'repo'];
  const remoteUrl = `${host}/${owner}/${repo}`;
  const scope = nock(host);
  scope.post(`/api/v4/projects/legacy%2Frepo/releases`).reply(404);
  scope.post(`/api/v4/projects/legacy%2Frepo/repository/tags/1.0.1/release`).reply(200, {});
  const options = { git: { remoteUrl }, gitlab: { release: true, retryMinTimeout: 0, tokenRef } };
  const gitlab = factory(GitLab, { options });
  sinon.stub(gitlab, 'getLatestVersion').resolves('1.0.0');

  interceptUser({ host, owner });
  interceptMembers({ host, owner, project: repo });

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
