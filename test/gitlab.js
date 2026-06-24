import fs from 'node:fs';
import https from 'node:https';
import test, { before, after, afterEach, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import Git from '../lib/plugin/git/Git.js';
import GitLab from '../lib/plugin/gitlab/GitLab.js';
import { GitlabTestServer } from './util/https-server/server.js';
import { factory, runTasks } from './util/index.js';
import {
  interceptUser,
  interceptCollaborator,
  interceptPublish,
  interceptAsset,
  interceptAssetGeneric,
  interceptMilestones,
  interceptMembers
} from './stub/gitlab.js';
import { mockFetch } from './util/mock.js';

describe('GitLab', () => {
  const tokenHeader = 'Private-Token';
  const tokenRef = 'GITLAB_TOKEN';
  const certificateAuthorityFileRef = 'CI_SERVER_TLS_CA_FILE';

  const [mocker, api, example, local] = mockFetch([
    'https://gitlab.com/api/v4',
    'https://gitlab.example.org/api/v4',
    'https://localhost:3000/api/v4'
  ]);

  before(() => {
    mocker.mockGlobal();
  });

  let originalEnv;
  beforeEach(() => {
    originalEnv = process.env;
    process.env = { ...originalEnv };

    process.env[tokenRef] = '123';
  });

  afterEach(() => {
    if (originalEnv !== undefined) process.env = originalEnv;
    mocker.clearAll();
  });

  after(() => {
    mocker.unmockGlobal();
  });

  test('should validate token', async () => {
    const tokenRef = 'MY_GITLAB_TOKEN';
    const pushRepo = 'https://gitlab.com/user/repo';
    const options = { gitlab: { release: true, tokenRef, tokenHeader, pushRepo } };
    const gitlab = await factory(GitLab, { options });
    delete process.env[tokenRef];

    await assert.rejects(gitlab.init(), /Environment variable "MY_GITLAB_TOKEN" is required for GitLab releases/);

    process.env[tokenRef] = '123';

    interceptUser(api, { headers: { 'private-token': '123' } });
    interceptCollaborator(api, { headers: { 'private-token': '123' } });
    await assert.doesNotReject(gitlab.init());
  });

  test('should support CI Job token header', async () => {
    const tokenRef = 'CI_JOB_TOKEN';
    const tokenHeader = 'Job-Token';
    process.env[tokenRef] = 'j0b-t0k3n';
    const pushRepo = 'https://gitlab.com/user/repo';
    const options = { git: { pushRepo }, gitlab: { release: true, tokenRef, tokenHeader } };
    const gitlab = await factory(GitLab, { options });

    interceptPublish(api, { headers: { 'job-token': '1' } });

    await assert.doesNotReject(gitlab.init());

    delete process.env[tokenRef];
  });

  test('should upload assets and release', async t => {
    const pushRepo = 'https://gitlab.com/user/repo';
    const options = {
      git: { pushRepo },
      gitlab: {
        tokenRef,
        release: true,
        releaseName: 'Release ${version}',
        releaseNotes: 'echo Custom notes',
        assets: 'test/resources/file-v${version}.txt',
        milestones: ['${version}', '${latestVersion} UAT']
      }
    };
    const gitlab = await factory(GitLab, { options });
    t.mock.method(gitlab, 'getLatestVersion', () => Promise.resolve('2.0.0'));

    const git = await factory(Git);
    const ref = (await git.getBranchName()) ?? 'HEAD';

    interceptUser(api);
    interceptCollaborator(api);
    interceptMilestones(api, { query: { title: '2.0.1' }, milestones: [{ id: 17, iid: 3, title: '2.0.1' }] });
    interceptMilestones(api, { query: { title: '2.0.0 UAT' }, milestones: [{ id: 42, iid: 4, title: '2.0.0 UAT' }] });
    interceptAsset(api);
    interceptPublish(api, {
      body: {
        name: 'Release 2.0.1',
        ref,
        tag_name: '2.0.1',
        tag_message: 'Release 2.0.1',
        description: 'Custom notes',
        assets: {
          links: [
            { name: 'file-v2.0.1.txt', url: `${pushRepo}/uploads/7e8bec1fe27cc46a4bc6a91b9e82a07c/file-v2.0.1.txt` }
          ]
        },
        milestones: ['2.0.1', '2.0.0 UAT']
      }
    });

    await runTasks(gitlab);

    assert.equal(gitlab.assets[0].url, `${pushRepo}/uploads/7e8bec1fe27cc46a4bc6a91b9e82a07c/file-v2.0.1.txt`);
    const { isReleased, releaseUrl } = gitlab.getContext();
    assert(isReleased);
    assert.equal(releaseUrl, `${pushRepo}/-/releases/2.0.1`);
  });

  test('should upload assets with ID-based URLs', async t => {
    const host = 'https://gitlab.com';
    const pushRepo = `${host}/user/repo`;
    const options = {
      git: { pushRepo },
      gitlab: {
        tokenRef,
        release: true,
        assets: 'test/resources/file-v${version}.txt',
        useIdsForUrls: true
      }
    };

    const gitlab = await factory(GitLab, { options });
    t.mock.method(gitlab, 'getLatestVersion', () => Promise.resolve('2.0.0'));

    interceptUser(api);
    interceptCollaborator(api);
    interceptAsset(api);
    interceptPublish(api);

    await runTasks(gitlab);

    assert.equal(
      gitlab.assets[0].url,
      `${host}/-/project/1234/uploads/7e8bec1fe27cc46a4bc6a91b9e82a07c/file-v2.0.1.txt`
    );
  });

  test('should upload assets to generic repo', async t => {
    const host = 'https://gitlab.com';
    const pushRepo = `${host}/user/repo`;
    const options = {
      git: { pushRepo },
      gitlab: {
        tokenRef,
        release: true,
        assets: 'test/resources/file-v${version}.txt',
        useGenericPackageRepositoryForAssets: true,
        genericPackageRepositoryName: 'release-it'
      }
    };
    const gitlab = await factory(GitLab, { options });
    t.mock.method(gitlab, 'getLatestVersion', () => Promise.resolve('2.0.0'));

    interceptUser(api);
    interceptCollaborator(api);
    interceptAssetGeneric(api);
    interceptPublish(api);

    await runTasks(gitlab);

    assert.equal(
      gitlab.assets[0].url,
      `${host}/api/v4/projects/user%2Frepo/packages/generic/release-it/2.0.1/file-v2.0.1.txt`
    );
  });

  test('should throw when release milestone is missing', async t => {
    const pushRepo = 'https://gitlab.com/user/repo';
    const options = {
      git: { pushRepo },
      gitlab: {
        tokenRef,
        release: true,
        milestones: ['${version}', '${latestVersion} UAT']
      }
    };
    const gitlab = await factory(GitLab, { options });
    t.mock.method(gitlab, 'getLatestVersion', () => Promise.resolve('2.0.0'));

    interceptUser(api);
    interceptCollaborator(api);
    interceptMilestones(api, { query: { title: '2.0.1' }, milestones: [{ id: 17, iid: 3, title: '2.0.1' }] });
    interceptMilestones(api, { query: { title: '2.0.0 UAT' }, milestones: [] });

    await assert.rejects(
      runTasks(gitlab),
      /Missing one or more milestones in GitLab. Creating a GitLab release will fail./
    );
  });

  test('should release to self-managed host', async t => {
    const host = 'https://gitlab.example.org';
    const options = {
      git: { pushRepo: `${host}/user/repo` },
      gitlab: { releaseName: 'Release ${version}', releaseNotes: 'echo readme', tokenRef }
    };
    const gitlab = await factory(GitLab, { options });
    t.mock.method(gitlab, 'getLatestVersion', () => Promise.resolve('1.0.0'));

    interceptUser(example);
    interceptCollaborator(example);
    interceptPublish(example);

    await runTasks(gitlab);

    const { origin, baseUrl } = gitlab.getContext();
    assert.equal(origin, host);
    assert.equal(baseUrl, `${host}/api/v4`);
  });

  test('should release to sub-grouped repo', async () => {
    const options = { gitlab: { tokenRef }, git: { pushRepo: 'git@gitlab.com:group/sub-group/repo.git' } };
    const gitlab = await factory(GitLab, { options });

    interceptUser(api, { owner: 'sub-group' });
    interceptCollaborator(api, { owner: 'sub-group', group: 'group' });
    interceptPublish(api, { owner: 'group', project: 'sub-group%2Frepo' });

    await runTasks(gitlab);

    const { isReleased, releaseUrl } = gitlab.getContext();
    assert(isReleased);
    assert.match(releaseUrl, /https:\/\/gitlab.com\/group\/sub-group(\/|%2F)repo\/-\/releases\//);
  });

  test('should throw for unauthenticated user', async () => {
    const host = 'https://gitlab.com';
    const pushRepo = `${host}/user/repo`;
    const options = { gitlab: { tokenRef, pushRepo, host } };
    const gitlab = await factory(GitLab, { options });

    api.get('/user', { status: 401 });

    await assert.rejects(
      runTasks(gitlab),
      /Could not authenticate with GitLab using environment variable "GITLAB_TOKEN"/
    );
  });

  test('should throw for non-collaborator', async () => {
    const host = 'https://gitlab.com';
    const pushRepo = `${host}/john/repo`;
    const options = { gitlab: { tokenRef, pushRepo, host } };
    const gitlab = await factory(GitLab, { options });

    interceptMembers(api, { owner: 'emma' });
    interceptUser(api, { owner: 'john' });

    await assert.rejects(runTasks(gitlab), /User john is not a collaborator for john\/repo/);
  });

  test('should throw for insufficient access level', async () => {
    const host = 'https://gitlab.com';
    const pushRepo = `${host}/john/repo`;
    const options = { gitlab: { tokenRef, pushRepo, host } };
    const gitlab = await factory(GitLab, { options });

    interceptMembers(api, { owner: 'john', access_level: 10 });
    interceptUser(api, { owner: 'john' });

    await assert.rejects(runTasks(gitlab), /User john is not a collaborator for john\/repo/);
  });

  test('should not make requests in dry run', async t => {
    const [host, owner, repo] = ['https://gitlab.example.org', 'user', 'repo'];
    const pushRepo = `${host}/${owner}/${repo}`;
    const options = { 'dry-run': true, git: { pushRepo }, gitlab: { releaseName: 'R', tokenRef } };
    const gitlab = await factory(GitLab, { options });
    t.mock.method(gitlab, 'getLatestVersion', () => Promise.resolve('1.0.0'));

    await runTasks(gitlab);

    const { isReleased, releaseUrl } = gitlab.getContext();

    assert.equal(gitlab.log.exec.mock.calls[2].arguments[0], 'gitlab releases#uploadAssets');
    assert.equal(gitlab.log.exec.mock.calls[3].arguments[0], 'gitlab releases#createRelease "R" (1.0.1)');
    assert(isReleased);
    assert.equal(releaseUrl, `${pushRepo}/-/releases/1.0.1`);
  });

  test('should skip checks', async () => {
    const options = { gitlab: { tokenRef, skipChecks: true, release: true, milestones: ['v1.0.0'] } };
    const gitlab = await factory(GitLab, { options });

    await assert.doesNotReject(gitlab.init());
    await assert.doesNotReject(gitlab.beforeRelease());

    assert.equal(
      gitlab.log.exec.mock.calls
        .flatMap(call => call.arguments)
        .filter(entry => /checkReleaseMilestones/.test(entry[0])).length,
      0
    );
  });

  test('should not create https agent', async () => {
    const options = { gitlab: {} };
    const gitlab = await factory(GitLab, { options });

    assert.equal(gitlab.httpsAgent, undefined);
  });

  test('should create https agent if secure == false', async () => {
    const options = { gitlab: { secure: false } };
    const gitlab = await factory(GitLab, { options });

    assert(gitlab.httpsAgent instanceof https.Agent, 'HTTPS agent should be an instance of https.Agent');
    assert.equal(gitlab.httpsAgent.options.rejectUnauthorized, false);
    assert.equal(gitlab.httpsAgent.options.ca, undefined);
  });

  test('should create https agent if certificateAuthorityFile', async t => {
    const readFileSync = t.mock.method(fs, 'readFileSync', () => 'test certificate');

    const options = { gitlab: { certificateAuthorityFile: 'cert.crt' } };
    const gitlab = await factory(GitLab, { options });

    assert(gitlab.httpsAgent instanceof https.Agent, 'HTTPS agent should be an instance of https.Agent');
    assert.equal(gitlab.httpsAgent.options.rejectUnauthorized, undefined);
    assert.equal(gitlab.httpsAgent.options.ca, 'test certificate');

    readFileSync.mock.restore();
  });

  test('should create https agent if CI_SERVER_TLS_CA_FILE env is set', async t => {
    const readFileSync = t.mock.method(fs, 'readFileSync', () => 'test certificate');
    process.env[certificateAuthorityFileRef] = 'ca.crt';

    const options = { gitlab: {} };
    const gitlab = await factory(GitLab, { options });

    assert(gitlab.httpsAgent instanceof https.Agent, 'HTTPS agent should be an instance of https.Agent');
    assert.equal(gitlab.httpsAgent.options.rejectUnauthorized, undefined);
    assert.equal(gitlab.httpsAgent.options.ca, 'test certificate');

    readFileSync.mock.restore();
  });

  test('should create https agent if certificateAuthorityFileRef env is set', async t => {
    const readFileSync = t.mock.method(fs, 'readFileSync', () => 'test certificate');
    process.env['GITLAB_CA_FILE'] = 'custom-ca.crt';

    const options = { gitlab: { certificateAuthorityFileRef: 'GITLAB_CA_FILE' } };
    const gitlab = await factory(GitLab, { options });

    assert(gitlab.httpsAgent instanceof https.Agent, 'HTTPS agent should be an instance of https.Agent');
    assert.equal(gitlab.httpsAgent.options.rejectUnauthorized, undefined);
    assert.equal(gitlab.httpsAgent.options.ca, 'test certificate');

    readFileSync.mock.restore();
  });

  test('should throw for insecure connections to self-hosted instances', async t => {
    const host = 'https://localhost:3000';

    const options = {
      git: { pushRepo: `${host}/user/repo` },
      gitlab: { host, tokenRef, origin: host }
    };
    const gitlab = await factory(GitLab, { options });
    const server = new GitlabTestServer();

    t.after(async () => {
      await server.stop();
    });

    await server.run();

    await assert.rejects(gitlab.init(), /Could not authenticate with GitLab using environment variable "GITLAB_TOKEN"/);
  });

  test('should succesfully connect to self-hosted instance if insecure connection allowed', async t => {
    const host = 'https://localhost:3000';

    const options = {
      git: { pushRepo: `${host}/user/repo` },
      gitlab: {
        host,
        tokenRef,
        origin: host,
        secure: false
      }
    };
    const gitlab = await factory(GitLab, { options });
    const server = new GitlabTestServer();

    t.after(async () => {
      await server.stop();
    });

    await server.run();

    interceptUser(local);
    interceptCollaborator(local);

    await assert.doesNotReject(gitlab.init());
  });

  test('should succesfully connect to self-hosted instance with valid CA file', async t => {
    const host = 'https://localhost:3000';

    const options = {
      git: { pushRepo: `${host}/user/repo` },
      gitlab: {
        host,
        tokenRef,
        origin: host,
        certificateAuthorityFile: 'test/util/https-server/client/my-private-root-ca.cert.pem'
      }
    };
    const gitlab = await factory(GitLab, { options });
    const server = new GitlabTestServer();

    t.after(async () => {
      await server.stop();
    });

    await server.run();

    interceptUser(local);
    interceptCollaborator(local);

    await assert.doesNotReject(gitlab.init());
  });

  describe('HTTPS transport', () => {
    const startSelfHostedGitLab = async (t, { port = 3000, protocol = 'https', gitlab: gitlabOptions = {} } = {}) => {
      const host = `${protocol}://localhost:${port}`;
      const server = new GitlabTestServer({ protocol });

      t.after(async () => {
        await server.stop();
      });

      await server.run(port);

      const gitlab = await factory(GitLab, {
        options: {
          ci: true,
          git: { pushRepo: `${host}/user/repo` },
          gitlab: {
            tokenRef,
            origin: host,
            secure: false,
            skipChecks: true,
            release: true,
            ...gitlabOptions
          }
        }
      });

      await gitlab.init();
      gitlab.config.setContext({
        version: '2.0.1',
        tagName: '2.0.1',
        branchName: 'main',
        name: 'test'
      });
      gitlab.setContext({
        version: '2.0.1',
        tagName: '2.0.1',
        branchName: 'main'
      });

      return { gitlab, host };
    };

    test('should upload asset via https transport', async t => {
      const { gitlab, host } = await startSelfHostedGitLab(t);

      await gitlab.uploadAsset('test/resources/file-v2.0.1.txt');

      assert.equal(
        gitlab.assets[0].url,
        `${host}/user/repo/uploads/7e8bec1fe27cc46a4bc6a91b9e82a07c/file-v2.0.1.txt`
      );
    });

    test('should upload asset to generic repo via https transport', async t => {
      const { gitlab, host } = await startSelfHostedGitLab(t, {
        gitlab: {
          useGenericPackageRepositoryForAssets: true,
          genericPackageRepositoryName: 'release-it'
        }
      });

      await gitlab.uploadAsset('test/resources/file-v2.0.1.txt');

      assert.equal(
        gitlab.assets[0].url,
        `${host}/api/v4/projects/user%2Frepo/packages/generic/release-it/2.0.1/file-v2.0.1.txt`
      );
    });

    test('should throw when generic asset upload response is invalid via https transport', async t => {
      const { gitlab } = await startSelfHostedGitLab(t, {
        gitlab: {
          useGenericPackageRepositoryForAssets: true,
          genericPackageRepositoryName: 'release-it'
        }
      });

      await assert.rejects(gitlab.uploadAsset('test/resources/invalid-upload.txt'), /GitLab asset upload failed/);
    });

    test('should create release via https transport', async t => {
      const { gitlab, host } = await startSelfHostedGitLab(t);

      await gitlab.createRelease();

      const { isReleased, releaseUrl } = gitlab.getContext();
      assert(isReleased);
      assert.equal(releaseUrl, `${host}/user/repo/-/releases/2.0.1`);
    });

    test('should upload assets and release via https transport', async t => {
      const { gitlab, host } = await startSelfHostedGitLab(t, {
        gitlab: {
          assets: 'test/resources/file-v2.0.1.txt',
          releaseName: 'Release ${version}'
        }
      });

      await gitlab.uploadAssets();
      await gitlab.createRelease();

      assert.equal(
        gitlab.assets[0].url,
        `${host}/user/repo/uploads/7e8bec1fe27cc46a4bc6a91b9e82a07c/file-v2.0.1.txt`
      );

      const { isReleased, releaseUrl } = gitlab.getContext();
      assert(isReleased);
      assert.equal(releaseUrl, `${host}/user/repo/-/releases/2.0.1`);
    });

    test('should reject https requests with json error response', async t => {
      const { gitlab } = await startSelfHostedGitLab(t);

      await assert.rejects(gitlab.request('forbidden-json', { method: 'GET' }), /Forbidden/);
    });

    test('should reject https requests with text error response', async t => {
      const { gitlab } = await startSelfHostedGitLab(t);

      await assert.rejects(gitlab.request('forbidden-text', { method: 'GET' }), /Internal Server Error/);
    });

    test('should communicate over http transport when origin uses http', async t => {
      const host = 'http://localhost:3001';
      const server = new GitlabTestServer({ protocol: 'http' });

      t.after(async () => {
        await server.stop();
      });

      await server.run(3001);

      const gitlab = await factory(GitLab, {
        options: {
          git: { pushRepo: `${host}/user/repo` },
          gitlab: {
            tokenRef,
            origin: host,
            secure: false
          }
        }
      });

      await assert.doesNotReject(gitlab.init());
    });
  });
});
