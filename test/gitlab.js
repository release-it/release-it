const test = require('ava');
const sinon = require('sinon');
const nock = require('nock');
const GitLab = require('../lib/plugin/gitlab/GitLab');
const {
  interceptUser,
  interceptCollaborator,
  interceptCollaboratorFallback,
  interceptPublish,
  interceptAsset
} = require('./stub/gitlab');
const { factory, runTasks } = require('./util');

const tokenRef = 'GITLAB_TOKEN';

test.serial('should validate token', async t => {
  const tokenRef = 'MY_GITLAB_TOKEN';
  const pushRepo = 'https://gitlab.com/user/repo';
  const options = { gitlab: { release: true, tokenRef, pushRepo } };
  const gitlab = factory(GitLab, { options });
  delete process.env[tokenRef];

  await t.throwsAsync(gitlab.init(), {
    message: /Environment variable "MY_GITLAB_TOKEN" is required for GitLab releases/
  });
  process.env[tokenRef] = '123'; // eslint-disable-line require-atomic-updates

  interceptUser();
  interceptCollaborator();
  await t.notThrowsAsync(gitlab.init());
});

test.serial('should upload assets and release', async t => {
  const pushRepo = 'https://gitlab.com/user/repo';
  const asset = 'file1';
  const options = {
    git: { pushRepo },
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
  interceptCollaborator();
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
            url: `${pushRepo}/uploads/7e8bec1fe27cc46a4bc6a91b9e82a07c/${asset}`
          }
        ]
      }
    }
  });

  await runTasks(gitlab);

  t.is(gitlab.assets[0].url, `${pushRepo}/uploads/7e8bec1fe27cc46a4bc6a91b9e82a07c/${asset}`);
  const { isReleased, releaseUrl } = gitlab.getContext();
  t.true(isReleased);
  t.is(releaseUrl, `${pushRepo}/-/releases`);
});

test.serial('should release to self-managed host', async t => {
  const host = 'https://gitlab.example.org';
  const scope = nock(host);
  scope.post('/api/v4/projects/user%2Frepo/releases').reply(200, {});
  const options = {
    git: { pushRepo: `${host}/user/repo` },
    gitlab: { releaseName: 'Release ${version}', releaseNotes: 'echo readme', tokenRef }
  };
  const gitlab = factory(GitLab, { options });
  sinon.stub(gitlab, 'getLatestVersion').resolves('1.0.0');

  interceptUser({ host });
  interceptCollaborator({ host });

  await runTasks(gitlab);

  t.is(gitlab.origin, host);
  t.is(gitlab.baseUrl, `${host}/api/v4`);
});

test.serial('should release to sub-grouped repo', async t => {
  const scope = nock('https://gitlab.com');
  scope.post('/api/v4/projects/group%2Fsub-group%2Frepo/releases').reply(200, {});
  const options = { gitlab: { tokenRef }, git: { pushRepo: 'git@gitlab.com:group/sub-group/repo.git' } };
  const gitlab = factory(GitLab, { options });

  interceptUser({ owner: 'sub-group' });
  interceptCollaborator({ owner: 'sub-group', group: 'group' });

  await runTasks(gitlab);

  const { isReleased, releaseUrl } = gitlab.getContext();
  t.true(isReleased);
  t.is(releaseUrl, 'https://gitlab.com/group/sub-group/repo/-/releases');
});

test.serial('should throw for unauthenticated user', async t => {
  const host = 'https://gitlab.com';
  const pushRepo = `${host}/user/repo`;
  const options = { gitlab: { tokenRef, pushRepo, host } };
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
  const pushRepo = `${host}/john/repo`;
  const options = { gitlab: { tokenRef, pushRepo, host } };
  const gitlab = factory(GitLab, { options });
  const scope = nock(host);
  scope.get(`/api/v4/projects/john%2Frepo/members/all/1`).reply(200, { username: 'emma' });
  interceptUser({ owner: 'john' });

  await t.throwsAsync(runTasks(gitlab), {
    instanceOf: Error,
    message: 'User john is not a collaborator for john/repo.'
  });
});

test.serial('should throw for insufficient access level', async t => {
  const host = 'https://gitlab.com';
  const pushRepo = `${host}/john/repo`;
  const options = { gitlab: { tokenRef, pushRepo, host } };
  const gitlab = factory(GitLab, { options });
  const scope = nock(host);
  scope.get(`/api/v4/projects/john%2Frepo/members/all/1`).reply(200, { username: 'john', access_level: 10 });
  interceptUser({ owner: 'john' });

  await t.throwsAsync(runTasks(gitlab), {
    instanceOf: Error,
    message: 'User john is not a collaborator for john/repo.'
  });
});

test.serial('should fallback for gitlab < v12.4', async t => {
  const host = 'https://gitlab.com';
  const pushRepo = `${host}/user/repo`;
  const options = { gitlab: { tokenRef, pushRepo, host } };
  const gitlab = factory(GitLab, { options });
  const scope = nock(host);
  scope.get(`/api/v4/projects/user%2Frepo/members/all/1`).reply(404);
  interceptUser();
  interceptCollaboratorFallback();

  await t.notThrowsAsync(gitlab.init());
});

test('should not make requests in dry run', async t => {
  const [host, owner, repo] = ['https://gitlab.example.org', 'user', 'repo'];
  const pushRepo = `${host}/${owner}/${repo}`;
  const options = { git: { pushRepo }, gitlab: { releaseName: 'R', tokenRef } };
  const gitlab = factory(GitLab, { options, global: { isDryRun: true } });
  sinon.stub(gitlab, 'getLatestVersion').resolves('1.0.0');
  const spy = sinon.spy(gitlab, 'client', ['get']);

  await runTasks(gitlab);

  const { isReleased, releaseUrl } = gitlab.getContext();
  t.is(spy.get.callCount, 0);
  t.is(gitlab.log.exec.args[1][0], 'gitlab releases#uploadAssets');
  t.is(gitlab.log.exec.args[2][0], 'gitlab releases#createRelease "R" (1.0.1)');
  t.true(isReleased);
  t.is(releaseUrl, `${pushRepo}/-/releases`);
  spy.restore();
});

test('should skip checks', async t => {
  const options = { gitlab: { tokenRef, skipChecks: true } };
  const gitlab = factory(GitLab, { options });
  await t.notThrowsAsync(gitlab.init());
});
