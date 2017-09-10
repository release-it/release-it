import test from 'tape';
import proxyquire from 'proxyquire';
import * as logMock from './mock/log';
import Config from '../lib/config';
import { pushd, popd, mkStageDir } from '../lib/shell';
import { getRemoteUrl, clone, getLatestTag } from '../lib/git';
import repoPathParse from 'parse-repo';

const config = new Config();

const mocks = {
  './log': logMock,
  './config': {
    config
  }
};

const { release, uploadAssets } = proxyquire('../lib/github-client', mocks);

test('release + uploadAssets', async t => {
  const dir = 'test/resources';
  const tmp = `${dir}/tmp`;
  const repository = 'https://github.com/webpro/release-it-test';
  const asset = 'file1';
  const { cleanup } = await mkStageDir(tmp);
  await clone(`${repository}.git`, tmp);
  await pushd(tmp);

  const version = await getLatestTag();
  const remoteUrl = await getRemoteUrl();
  const changelog = '';
  const tagName = 'v%s';
  const repo = repoPathParse(remoteUrl);
  const github = {
    releaseName: 'Release %s',
    preRelease: false,
    draft: false,
    assets: asset,
    token: process.env.GITHUB_TOKEN
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

  const [uploadResult] = await uploadAssets({ releaseId: releaseResult.id, repo, github });

  t.equal(uploadResult.name, asset);
  t.equal(uploadResult.state, 'uploaded');
  t.equal(uploadResult.browser_download_url, `${repository}/releases/download/v${version}/${asset}`);

  await popd();
  await cleanup();
  t.end();
});
