const test = require('tape');
const sinon = require('sinon');
const npm = require('../lib/npm');

test('getPackageUrl', t => {
  const npmClient = new npm({ name: 'my-cool-package' });
  t.equal(npmClient.getPackageUrl(), 'https://www.npmjs.com/package/my-cool-package');
  t.end();
});

test('getTag', t => {
  const npmClient = new npm();
  const tag = npmClient.getTag();
  t.equal(tag, 'latest');
  t.end();
});

test('getTag (pre-release)', t => {
  const npmClient = new npm();
  const tag = npmClient.getTag({ isPreRelease: true, tag: 'beta' });
  t.equal(tag, 'beta');
  t.end();
});

test('getTag (pre-release continuation)', t => {
  const npmClient = new npm();
  const tag = npmClient.getTag({ isPreRelease: true, version: '1.0.2-alpha.3' });
  t.equal(tag, 'alpha');
  t.end();
});

test('getTag (pre-release discontinuation)', t => {
  const npmClient = new npm();
  const tag = npmClient.getTag({ version: '1.0.2-alpha.3' });
  t.equal(tag, 'latest');
  t.end();
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
  t.equal(run.callCount, 1);
  t.equal(run.firstCall.args[0].trim(), 'npm publish . --tag latest');
  t.end();
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
  t.equal(run.callCount, 1);
  t.equal(run.firstCall.args[0].trim(), 'npm publish . --tag beta --access public');
  t.end();
});
