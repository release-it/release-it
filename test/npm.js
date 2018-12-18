const test = require('tape');
const proxyquire = require('proxyquire');
const { Config } = require('../lib/config');
const { getPackageUrl, getTag } = require('../lib/npm');

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
