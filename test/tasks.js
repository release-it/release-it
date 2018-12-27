const test = require('tape');
const sh = require('shelljs');
const mockStdIo = require('mock-stdio');
const { gitAdd, readJSON } = require('./util/index');
const runTasks = require('../lib/tasks');
const {
  GitRepoError,
  GitRemoteUrlError,
  GitCleanWorkingDirError,
  GitUpstreamError,
  GithubTokenError,
  InvalidVersionError,
  DistRepoStageDirError
} = require('../lib/errors');

const tmp = 'test/resources/tmp';
const tmpBare = 'test/resources/bare.git';

const tasks = options => {
  return runTasks(
    Object.assign(
      {
        config: false,
        'non-interactive': true,
        'disable-metrics': true
      },
      options
    )
  );
};

const prepare = () => {
  sh.exec(`git init --bare ${tmpBare}`);
  sh.exec(`git clone ${tmpBare} ${tmp}`);
  sh.pushd('-q', tmp);
  gitAdd('line', 'file', 'Add file');
};

const cleanup = () => {
  sh.popd('-q');
  sh.rm('-rf', [tmp, tmpBare]);
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
    GithubTokenError,
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
  await tasks({
    increment: 'patch',
    pkgFiles: null,
    manifest: false,
    npm: {
      publish: false
    }
  });
  const { stdout } = mockStdIo.end();
  t.ok(stdout.includes('release tmp (0.0.0...0.0.1)'));
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

test('should use version from package.json (w/o git tag)', async t => {
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

test('should use version from package.json (in sub dir) w/o tagging repo', async t => {
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
  await tasks({
    increment: 'major',
    manifest: false,
    npm: {
      publish: false
    }
  });
  const { stdout } = mockStdIo.end();
  t.ok(stdout.includes('release tmp (1.0.0...2.0.0)'));
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
