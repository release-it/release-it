import test from 'tape';
import proxyquire from 'proxyquire';
import shell from 'shelljs';
import * as github from './mock/github';
import { pushd, popd } from '../lib/shell';
import repoPathParse from 'parse-repo';

const { release, uploadAssets } = proxyquire('../lib/github-client', { github });

test('release + uploadAssets', async t => {
  const dir = 'test/resources';
  shell.pushd(dir);

  const remoteUrl = 'https://github.com/webpro/release-it-test';
  const asset = 'file1';
  const version = '2.0.1';
  const changelog = '';
  const tagName = 'v%s';
  const repo = repoPathParse(remoteUrl);
  const github = {
    releaseName: 'Release %s',
    preRelease: false,
    draft: false,
    assets: asset,
    token: 'fake token'
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
  t.equal(uploadResult.browser_download_url, `${remoteUrl}/releases/download/v${version}/${asset}`);

  shell.popd();
  t.end();
});
