const test = require('tape');
const proxyquire = require('proxyquire');
const mockStdIo = require('mock-stdio');
const semver = require('semver');
const { Config, config } = require('../lib/config');
const { run } = require('../lib/shell');
const { getPackageUrl, getTag, publish } = require('../lib/npm');

const getMock = config =>
  proxyquire('../lib/npm', {
    './config': { config }
  });

test('getPackageUrl', t => {
  t.equal(getPackageUrl('my-cool-package'), 'https://www.npmjs.com/package/my-cool-package');
  t.end();
});

test('getTag', t => {
  t.equal(getTag(), 'latest');
  t.end();
});

test('getTag (pre-release)', t => {
  const npm = getMock(new Config({}, '--preRelease=beta'));
  t.equal(npm.getTag(), 'beta');
  t.end();
});

test('getTag (pre-release continuation)', t => {
  const npm = getMock(new Config({ version: '1.0.2-alpha.3' }, '--preRelease'));
  t.equal(npm.getTag(), 'alpha');
  t.end();
});

test('getTag (pre-release w/ different tag)', t => {
  const npm = getMock(new Config({}, '--preRelease=beta --npm.tag=rc'));
  t.equal(npm.getTag(), 'rc');
  t.end();
});

test('publish', async t => {
  const npmMajor = semver.major(await run(`npm --version`));
  if (npmMajor < 6) {
    return t.end();
  }

  const { verbose, 'dry-run': dryRun } = config.options;
  config.options.verbose = true;
  config.options['dry-run'] = true;

  {
    mockStdIo.start();
    await publish({ publishPath: '.', tag: 'latest' });
    const { stdout } = mockStdIo.end();
    t.ok(stdout.includes('npm publish . --tag latest'));
  }

  {
    mockStdIo.start();
    await publish({ publishPath: '.', tag: 'beta', access: 'public' }, '@scoped/pkg');
    const { stdout } = mockStdIo.end();
    t.ok(stdout.includes('npm publish . --tag beta --access public'));
  }

  config.options.verbose = verbose;
  config.options['dry-run'] = dryRun;
  t.end();
});
