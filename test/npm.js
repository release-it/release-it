const test = require('tape');
const proxyquire = require('proxyquire');
const sinon = require('sinon');
const { Config } = require('../lib/config');
const shell = require('../lib/shell');
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
  const stub = sinon.stub(shell, 'run').resolves();
  await publish({ name: 'pkg', publishPath: '.', tag: 'latest' });
  t.equal(stub.callCount, 1);
  t.equal(stub.firstCall.args[0].trim(), 'npm publish . --tag latest');
  stub.restore();
  t.end();
});

test('publish (scoped)', async t => {
  const stub = sinon.stub(shell, 'run').resolves();
  await publish({ name: '@scoped/pkg', publishPath: '.', tag: 'beta', access: 'public' });
  t.equal(stub.callCount, 1);
  t.equal(stub.firstCall.args[0].trim(), 'npm publish . --tag beta --access public');
  stub.restore();
  t.end();
});
