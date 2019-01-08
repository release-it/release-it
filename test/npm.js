const test = require('ava');
const sinon = require('sinon');
const npm = require('../lib/npm');

test('getPackageUrl', t => {
  const npmClient = new npm({ name: 'my-cool-package' });
  t.is(npmClient.getPackageUrl(), 'https://www.npmjs.com/package/my-cool-package');
});

test('getTag', t => {
  const npmClient = new npm();
  const tag = npmClient.getTag();
  t.is(tag, 'latest');
});

test('getTag (pre-release)', t => {
  const npmClient = new npm();
  const tag = npmClient.getTag({ isPreRelease: true, tag: 'beta' });
  t.is(tag, 'beta');
});

test('getTag (pre-release continuation)', t => {
  const npmClient = new npm();
  const tag = npmClient.getTag({ isPreRelease: true, version: '1.0.2-alpha.3' });
  t.is(tag, 'alpha');
});

test('getTag (pre-release discontinuation)', t => {
  const npmClient = new npm();
  const tag = npmClient.getTag({ version: '1.0.2-alpha.3' });
  t.is(tag, 'latest');
});

test('publish', async t => {
  const run = sinon.stub().resolves();
  const npmClient = new npm({
    name: 'pkg',
    shell: {
      run
    }
  });
  await npmClient.publish();
  t.is(run.callCount, 1);
  t.is(run.firstCall.args[0].trim(), 'npm publish . --tag latest');
});

test('publish (scoped)', async t => {
  const run = sinon.stub().resolves();
  const npmClient = new npm({
    name: '@scoped/pkg',
    access: 'public',
    shell: {
      run
    }
  });
  await npmClient.publish({ tag: 'beta' });
  t.is(run.callCount, 1);
  t.is(run.firstCall.args[0].trim(), 'npm publish . --tag beta --access public');
});

test('publish (private)', async t => {
  const run = sinon.stub().resolves();
  const shell = { run };
  const warn = sinon.spy();
  const log = { warn };
  const npmClient = new npm({
    name: 'pkg',
    private: true,
    log,
    shell
  });
  await npmClient.publish();
  t.is(run.callCount, 0);
  t.is(warn.callCount, 1);
  t.true(warn.firstCall.args[0].includes('package is private'));
});
