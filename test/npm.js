const test = require('ava');
const sinon = require('sinon');
const npm = require('../lib/npm');

test('should return npm package url', t => {
  const npmClient = new npm({ name: 'my-cool-package' });
  t.is(npmClient.getPackageUrl(), 'https://www.npmjs.com/package/my-cool-package');
});

test('should return npm package url (custom registry)', t => {
  const npmClient = new npm({ name: 'my-cool-package', publishConfig: { registry: 'https://my-registry.com/' } });
  t.is(npmClient.getPackageUrl(), 'https://my-registry.com/package/my-cool-package');
});

test('should return tag', t => {
  const npmClient = new npm();
  const tag = npmClient.getTag();
  t.is(tag, 'latest');
});

test('should return tag for pre-release', t => {
  const npmClient = new npm();
  const tag = npmClient.getTag({ isPreRelease: true, tag: 'beta' });
  t.is(tag, 'beta');
});

test('should return tag for pre-release continuation', t => {
  const npmClient = new npm();
  const tag = npmClient.getTag({ isPreRelease: true, version: '1.0.2-alpha.3' });
  t.is(tag, 'alpha');
});

test('should return tag for pre-release discontinuation', t => {
  const npmClient = new npm();
  const tag = npmClient.getTag({ version: '1.0.2-alpha.3' });
  t.is(tag, 'latest');
});

test('should not throw if validation passes', async t => {
  const run = sinon.stub().resolves();
  const npmClient = new npm({
    name: 'pkg',
    shell: {
      run
    }
  });
  await t.notThrowsAsync(npmClient.validate());
});

test('should throw if npm is down', async t => {
  const registry = 'https://www.npmjs.com';
  const run = sinon.stub().resolves();
  run.withArgs(`npm ping --registry ${registry}`).rejects();

  const npmClient = new npm({
    name: 'pkg',
    publish: true,
    shell: {
      run
    },
    publishConfig: { registry }
  });
  await t.throwsAsync(npmClient.validate(), /Unable to reach npm registry/);
});

test('should throw if user is not authenticated', async t => {
  const run = sinon.stub().resolves();
  run.withArgs('npm whoami').rejects();
  const npmClient = new npm({
    name: 'pkg',
    publish: true,
    shell: {
      run
    }
  });
  await t.throwsAsync(npmClient.validate(), /Not authenticated with npm/);
});

test('should publish', async t => {
  const run = sinon.stub().resolves();
  const npmClient = new npm({
    name: 'pkg',
    shell: {
      run
    }
  });
  await npmClient.publish();
  t.is(run.callCount, 1);
  t.is(run.firstCall.args[0], 'npm publish . --tag latest');
});

test('should publish scoped package', async t => {
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
  t.is(run.firstCall.args[0], 'npm publish . --tag beta --access public');
});

test('should not publish private package', async t => {
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

test('should handle and publish with OTP', async t => {
  const run = sinon.stub();
  const warn = sinon.spy();
  const log = { warn };

  run.onFirstCall().rejects(new Error('Initial error with one-time pass.'));
  run.onSecondCall().rejects(new Error('The provided one-time pass is incorrect.'));
  run.onThirdCall().resolves();

  const npmClient = new npm({
    name: 'pkg',
    shell: {
      run
    },
    log
  });

  await npmClient.publish({
    otpCallback: () =>
      npmClient.publish({
        otp: '123',
        otpCallback: () => npmClient.publish({ otp: '123456' })
      })
  });

  t.is(run.callCount, 3);
  t.is(run.firstCall.args[0], 'npm publish . --tag latest');
  t.is(run.secondCall.args[0], 'npm publish . --tag latest  --otp 123');
  t.is(run.thirdCall.args[0], 'npm publish . --tag latest  --otp 123456');

  t.is(warn.callCount, 1);
  t.is(warn.firstCall.args[0], 'The provided OTP is incorrect or has expired.');
});
