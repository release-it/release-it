const path = require('path');
const { EOL } = require('os');
const test = require('tape');
const sh = require('shelljs');
const proxyquire = require('proxyquire');
const mockStdIo = require('mock-stdio');
const { gitAdd, readFile, readJSON } = require('./util/index');
const uuid = require('uuid/v4');
const GitHubApi = require('@octokit/rest');
const githubRequestMock = require('./mock/github.request');
const shell = require('../lib/shell');
const sinon = require('sinon');
const runTasks = require('../lib/tasks');
const {
  GitRepoError,
  GitRemoteUrlError,
  GitCleanWorkingDirError,
  GitUpstreamError,
  GitHubTokenError,
  InvalidVersionError,
  DistRepoStageDirError
} = require('../lib/errors');

const cwd = process.cwd();

const githubRequestStub = sinon.stub().callsFake(githubRequestMock);
const githubApi = new GitHubApi();
githubApi.hook.wrap('request', githubRequestStub);
const GitHubApiStub = sinon.stub().returns(githubApi);

const publishStub = sinon.stub().resolves();

class shellStub extends shell {
  run(command) {
    if (command.startsWith('npm publish')) {
      this.log.exec(command);
      return publishStub(...arguments);
    }
    return super.run(...arguments);
  }
}

const testConfig = {
  config: false,
  'non-interactive': true,
  'disable-metrics': true
};

const tasks = options => runTasks(Object.assign({}, testConfig, options));

const prepare = () => {
  const bare = path.resolve(cwd, 'tmp', uuid());
  const target = path.resolve(cwd, 'tmp', uuid());
  sh.pushd('-q', `${cwd}/tmp`);
  sh.exec(`git init --bare ${bare}`);
  sh.exec(`git clone ${bare} ${target}`);
  sh.pushd('-q', target);
  gitAdd('line', 'file', 'Add file');
  return { bare, target };
};

const cleanup = () => {
  sh.pushd('-q', cwd);
  githubRequestStub.resetHistory();
  publishStub.resetHistory();
};

test('should throw when not a Git repository', async t => {
  sh.pushd('-q', '..');
  await t.shouldBailOut(tasks(), GitRepoError, /Not a git repository/);
  sh.popd('-q');
  t.end();
});

test('should throw if there is no remote Git url', async t => {
  prepare();
  sh.exec('git remote remove origin');
  await t.shouldBailOut(tasks(), GitRemoteUrlError, /Could not get remote Git url/);
  cleanup();
  t.end();
});

test('should throw if working dir is not clean', async t => {
  prepare();
  sh.exec('rm file');
  await t.shouldBailOut(tasks(), GitCleanWorkingDirError, /Working dir must be clean/);
  cleanup();
  t.end();
});

test('should throw if no upstream is configured', async t => {
  prepare();
  sh.exec('git checkout -b foo');
  await t.shouldBailOut(tasks(), GitUpstreamError, /No upstream configured for current branch/);
  cleanup();
  t.end();
});

test('should throw if no GitHub token environment variable is set', async t => {
  prepare();
  await t.shouldBailOut(
    tasks({
      github: {
        release: true,
        tokenRef: 'GITHUB_FOO'
      }
    }),
    GitHubTokenError,
    /Environment variable "GITHUB_FOO" is required for GitHub releases/
  );
  cleanup();
  t.end();
});

test('should throw if invalid increment value is provided', async t => {
  prepare();
  await t.shouldBailOut(
    tasks({
      increment: 'mini'
    }),
    InvalidVersionError,
    /invalid version was provided/
  );
  cleanup();
  t.end();
});

test('should throw if not a subdir is provided for dist.stageDir', async t => {
  prepare();
  await t.shouldBailOut(
    tasks({
      dist: {
        repo: 'foo',
        stageDir: '..'
      }
    }),
    DistRepoStageDirError,
    /`dist.stageDir` \(".."\) must resolve to a sub directory/
  );
  cleanup();
  t.end();
});

test('should run tasks without throwing errors', async t => {
  prepare();
  mockStdIo.start();
  const { name, latestVersion, version } = await tasks({
    increment: 'patch',
    pkgFiles: null,
    manifest: false,
    npm: {
      publish: false
    }
  });
  const { stdout } = mockStdIo.end();
  t.ok(stdout.includes(`release ${name} (${latestVersion}...${version})`));
  t.ok(/Done \(in [0-9]+s\.\)/.test(stdout));
  cleanup();
  t.end();
});

test('should run tasks with minimal config and without any warnings/errors', async t => {
  prepare();
  gitAdd('{"name":"my-package","version":"1.2.3"}', 'package.json', 'Add package.json');
  sh.exec('git tag 1.2.3');
  gitAdd('line', 'file', 'More file');
  mockStdIo.start();
  await tasks({
    increment: 'patch',
    npm: {
      publish: false
    }
  });
  const { stdout } = mockStdIo.end();
  t.ok(stdout.includes('release my-package (1.2.3...1.2.4)'));
  t.ok(/Done \(in [0-9]+s\.\)/.test(stdout));
  const pkg = await readJSON('package.json');
  t.equal(pkg.version, '1.2.4');
  {
    const { stdout } = sh.exec('git describe --tags --abbrev=0');
    t.equal(stdout.trim(), '1.2.4');
  }
  cleanup();
  t.end();
});

test('should use pkg.version if no git tag', async t => {
  prepare();
  gitAdd('{"name":"my-package","version":"1.2.3"}', 'package.json', 'Add package.json');
  mockStdIo.start();
  await tasks({
    increment: 'minor',
    npm: {
      publish: false
    }
  });
  const { stdout } = mockStdIo.end();
  t.ok(stdout.includes('release my-package (1.2.3...1.3.0)'));
  t.ok(/Done \(in [0-9]+s\.\)/.test(stdout));
  const pkg = await readJSON('package.json');
  t.equal(pkg.version, '1.3.0');
  {
    const { stdout } = sh.exec('git describe --tags --abbrev=0');
    t.equal(stdout.trim(), '1.3.0');
  }
  cleanup();
  t.end();
});

test('should use pkg.version (in sub dir) w/o tagging repo', async t => {
  prepare();
  gitAdd('{"name":"root-package","version":"1.0.0"}', 'package.json', 'Add package.json');
  sh.exec('git tag 1.0.0');
  sh.mkdir('my-package');
  sh.pushd('-q', 'my-package');
  gitAdd('{"name":"my-package","version":"1.2.3"}', 'package.json', 'Add package.json');
  mockStdIo.start();
  await tasks({
    increment: 'minor',
    git: {
      tag: false
    },
    npm: {
      publish: false
    }
  });
  const { stdout } = mockStdIo.end();
  t.ok(stdout.includes('release my-package (1.2.3...1.3.0)'));
  t.ok(/Done \(in [0-9]+s\.\)/.test(stdout));
  const pkg = await readJSON('package.json');
  t.equal(pkg.version, '1.3.0');
  sh.popd('-q');
  {
    const { stdout } = sh.exec('git describe --tags --abbrev=0');
    t.equal(stdout.trim(), '1.0.0');
    const pkg = await readJSON('package.json');
    t.equal(pkg.version, '1.0.0');
  }
  cleanup();
  t.end();
});

test('should run tasks without package.json', async t => {
  prepare();
  sh.exec('git tag 1.0.0');
  mockStdIo.start();
  const { name } = await tasks({
    increment: 'major',
    npm: {
      publish: false
    }
  });
  const { stdout } = mockStdIo.end();
  t.ok(stdout.includes(`release ${name} (1.0.0...2.0.0)`));
  t.ok(stdout.includes('Could not bump package.json'));
  t.ok(stdout.includes('Could not stage package.json'));
  t.ok(/Done \(in [0-9]+s\.\)/.test(stdout));
  {
    const { stdout } = sh.exec('git describe --tags --abbrev=0');
    t.equal(stdout.trim(), '2.0.0');
  }
  cleanup();
  t.end();
});

test('#', st => {
  const runTasks = proxyquire('../lib/tasks', {
    '@octokit/rest': Object.assign(GitHubApiStub, { '@global': true }),
    './shell': Object.assign(shellStub, { '@global': true })
  });

  const tasks = options => runTasks(Object.assign({}, testConfig, options));

  st.test('should release all the things (basic)', async t => {
    const { bare, target } = prepare();
    const repoName = path.basename(bare);
    const pkgName = path.basename(target);
    sh.exec('git tag 1.0.0');
    gitAdd('line', 'file', 'More file');
    mockStdIo.start();
    await tasks({
      github: {
        release: true
      },
      npm: {
        name: pkgName,
        publish: true
      }
    });
    const { stdout } = mockStdIo.end();

    const githubReleaseArg = githubRequestStub.firstCall.lastArg;
    t.equal(githubRequestStub.callCount, 1);
    t.equal(githubReleaseArg.url, '/repos/:owner/:repo/releases');
    t.equal(githubReleaseArg.owner, null);
    t.equal(githubReleaseArg.repo, repoName);
    t.equal(githubReleaseArg.tag_name, '1.0.1');
    t.equal(githubReleaseArg.name, 'Release 1.0.1');
    t.ok(githubReleaseArg.body.startsWith('* More file'));
    t.equal(githubReleaseArg.prerelease, false);
    t.equal(githubReleaseArg.draft, false);

    t.equal(publishStub.firstCall.args[0].trim(), 'npm publish . --tag latest');

    t.ok(stdout.includes(`release ${pkgName} (1.0.0...1.0.1)`));
    t.ok(stdout.includes(`https://github.com/null/${repoName}/releases/tag/1.0.1`));
    t.ok(stdout.includes(`https://www.npmjs.com/package/${pkgName}`));

    cleanup();
    t.end();
  });

  st.test('should release all the things (pre-release, assets, dist repo)', async t => {
    const { bare, target } = prepare();
    const repoName = path.basename(bare);
    const pkgName = path.basename(target);
    const owner = null;
    {
      // Prepare fake dist repo
      sh.exec('git checkout -b dist');
      gitAdd(`dist-line${EOL}`, 'dist-file', 'Add dist file');
      sh.exec('git push -u origin dist');
    }
    sh.exec('git checkout -b master');
    sh.exec('git tag v1.0.0');
    gitAdd('line', 'file', 'More file');
    sh.exec('git push --follow-tags');
    mockStdIo.start();
    await tasks({
      increment: 'minor',
      preRelease: 'alpha',
      git: {
        tagName: 'v${version}'
      },
      github: {
        release: true,
        releaseNotes: 'echo "Notes for ${name} (v${version}): ${changelog}"',
        assets: ['file']
      },
      npm: {
        name: pkgName
      },
      dist: {
        repo: `${bare}#dist`,
        scripts: {
          beforeStage: `echo release-line >> dist-file`
        },
        npm: {
          publish: true
        }
      }
    });
    const { stdout } = mockStdIo.end();

    t.equal(githubRequestStub.callCount, 2);

    const githubReleaseArg = githubRequestStub.firstCall.lastArg;
    t.equal(githubReleaseArg.url, '/repos/:owner/:repo/releases');
    t.equal(githubReleaseArg.owner, owner);
    t.equal(githubReleaseArg.repo, repoName);
    t.equal(githubReleaseArg.tag_name, 'v1.1.0-alpha.0');
    t.equal(githubReleaseArg.name, 'Release 1.1.0-alpha.0');
    t.ok(RegExp(`Notes for ${pkgName} \\(v1.1.0-alpha.0\\): \\* More file`).test(githubReleaseArg.body));
    t.equal(githubReleaseArg.prerelease, true);
    t.equal(githubReleaseArg.draft, false);

    const githubAssetsArg = githubRequestStub.secondCall.lastArg;
    const { id } = githubRequestStub.firstCall.returnValue.data;
    t.ok(githubAssetsArg.url.endsWith(`/repos/${owner}/${repoName}/releases/${id}/assets{?name,label}`));
    t.equal(githubAssetsArg.name, 'file');

    t.equal(publishStub.callCount, 1);
    t.equal(publishStub.firstCall.args[0].trim(), 'npm publish . --tag alpha');

    {
      const { stdout } = sh.exec('git describe --tags --abbrev=0');
      t.equal(stdout.trim(), 'v1.1.0-alpha.0');
    }

    sh.exec('git checkout dist');
    sh.exec('git pull');
    const distFile = await readFile('dist-file');
    t.equal(distFile.trim(), `dist-line${EOL}release-line`);

    const [, sourceOutput, distOutput] = stdout.split('🚀');
    t.ok(sourceOutput.includes(`release ${pkgName} (1.0.0...1.1.0-alpha.0)`));
    t.ok(sourceOutput.includes(`https://github.com/${owner}/${repoName}/releases/tag/v1.1.0-alpha.0`));
    t.ok(distOutput.includes(`release the distribution repo for ${pkgName}`));
    t.ok(distOutput.includes(`https://www.npmjs.com/package/${pkgName}`));
    t.ok(/Done \(in [0-9]+s\.\)/.test(distOutput));

    cleanup();
    t.end();
  });
});
