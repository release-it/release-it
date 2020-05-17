const path = require('path');
const test = require('ava');
const sinon = require('sinon');
const mock = require('mock-fs');
const npm = require('../lib/plugin/npm/npm');
const { factory, runTasks } = require('./util');
const { getArgs } = require('./util/helpers');

test('should return npm package url', t => {
  const options = { npm: { name: 'my-cool-package' } };
  const npmClient = factory(npm, { options });
  t.is(npmClient.getPackageUrl(), 'https://www.npmjs.com/package/my-cool-package');
});

test('should return npm package url (custom registry)', t => {
  const options = { npm: { name: 'my-cool-package', publishConfig: { registry: 'https://my-registry.com/' } } };
  const npmClient = factory(npm, { options });
  t.is(npmClient.getPackageUrl(), 'https://my-registry.com/package/my-cool-package');
});

test('should return default tag', async t => {
  const npmClient = factory(npm);
  const tag = await npmClient.resolveTag();
  t.is(tag, 'latest');
});

test('should resolve default tag for pre-release', async t => {
  const npmClient = factory(npm);
  const stub = sinon.stub(npmClient, 'getRegistryPreReleaseTags').resolves([]);
  const tag = await npmClient.resolveTag('1.0.0-0');
  t.is(tag, 'next');
  stub.restore();
});

test('should guess tag from registry for pre-release', async t => {
  const npmClient = factory(npm);
  const stub = sinon.stub(npmClient, 'getRegistryPreReleaseTags').resolves(['alpha']);
  const tag = await npmClient.resolveTag('1.0.0-0');
  t.is(tag, 'alpha');
  stub.restore();
});

test('should derive tag from pre-release version', async t => {
  const npmClient = factory(npm);
  const tag = await npmClient.resolveTag('1.0.2-alpha.3');
  t.is(tag, 'alpha');
});

test('should use provided (default) tag even for pre-release', async t => {
  const options = { npm: { tag: 'latest' } };
  const npmClient = factory(npm, { options });
  const exec = sinon.stub(npmClient.shell, 'exec').resolves();
  await npmClient.bump('1.0.0-next.0');
  t.is(npmClient.getContext('tag'), 'latest');
  exec.restore();
});

test('should warn when bumping to same version', async t => {
  const npmClient = factory(npm);
  const exec = sinon
    .stub(npmClient.shell, 'exec')
    .rejects('npm ERR! Version not changed, might want --allow-same-version');
  await npmClient.bump('1.0.0-next.0');
  t.is(npmClient.log.warn.firstCall.args[0], 'Did not update version in package.json, etc. (already at 1.0.0-next.0).');
  exec.restore();
});

test('should return first pre-release tag from package in registry when resolving tag without pre-id', async t => {
  const npmClient = factory(npm);
  const response = {
    latest: '1.4.1',
    alpha: '2.0.0-alpha.1',
    beta: '2.0.0-beta.3'
  };
  const exec = sinon.stub(npmClient.shell, 'exec').resolves(JSON.stringify(response));
  t.is(await npmClient.resolveTag('2.0.0-5'), 'alpha');
  exec.restore();
});

test('should return default pre-release tag when resolving tag without pre-id', async t => {
  const npmClient = factory(npm);
  const response = {
    latest: '1.4.1'
  };
  const exec = sinon.stub(npmClient.shell, 'exec').resolves(JSON.stringify(response));
  t.is(await npmClient.resolveTag('2.0.0-0'), 'next');
  exec.restore();
});

test('should handle erroneous output when resolving tag without pre-id', async t => {
  const npmClient = factory(npm);
  const exec = sinon.stub(npmClient.shell, 'exec').resolves('');
  t.is(await npmClient.resolveTag('2.0.0-0'), 'next');
  exec.restore();
});

test('should handle errored request when resolving tag without pre-id', async t => {
  const npmClient = factory(npm);
  const exec = sinon.stub(npmClient.shell, 'exec').rejects();
  t.is(await npmClient.resolveTag('2.0.0-0'), 'next');
  exec.restore();
});

test('should add registry to commands when specified', async t => {
  const npmClient = factory(npm);
  npmClient.setContext({ publishConfig: { registry: 'registry.example.org' } });
  const exec = sinon.stub(npmClient.shell, 'exec').resolves();
  await runTasks(npmClient);
  t.is(exec.args[0][0], 'npm ping --registry registry.example.org');
  t.is(exec.args[1][0], 'npm whoami --registry registry.example.org');
  t.regex(exec.args[2][0], /npm show release-it@[a-z]+ version --registry registry\.example\.org/);
  exec.restore();
});

test('should not throw when executing tasks', async t => {
  const npmClient = factory(npm);
  const exec = sinon.stub(npmClient.shell, 'exec').resolves();
  await t.notThrowsAsync(runTasks(npmClient));
  exec.restore();
});

test('should throw if npm is down', async t => {
  const npmClient = factory(npm);
  const exec = sinon.stub(npmClient.shell, 'exec').resolves();
  exec.withArgs('npm ping').rejects();
  await t.throwsAsync(runTasks(npmClient), { message: /Unable to reach npm registry/ });
  exec.restore();
});

test('should not throw if npm returns 404 for unsupported ping/whoami', async t => {
  const npmClient = factory(npm);
  const exec = sinon.stub(npmClient.shell, 'exec').resolves();
  const pingError = "npm ERR! code E404\nnpm ERR! 404 Package '--ping' not found : ping";
  const whoamiError = "npm ERR! code E404\nnpm ERR! 404 Package '--whoami' not found : whoami";
  exec.withArgs('npm ping').rejects(new Error(pingError));
  exec.withArgs('npm whoami').rejects(new Error(whoamiError));
  await runTasks(npmClient);
  t.is(exec.lastCall.args[0].trim(), 'npm publish . --tag latest');
  exec.restore();
});

test('should not throw if npm returns 400 for unsupported ping/whoami', async t => {
  const npmClient = factory(npm);
  const exec = sinon.stub(npmClient.shell, 'exec').resolves();
  const pingError = 'npm ERR! code E400\nnpm ERR! 400 Bad Request - GET https://npm.example.org/-/ping?write=true';
  const whoamiError = 'npm ERR! code E400\nnpm ERR! 400 Bad Request - GET https://npm.example.org/-/whoami';
  exec.withArgs('npm ping').rejects(new Error(pingError));
  exec.withArgs('npm whoami').rejects(new Error(whoamiError));
  await runTasks(npmClient);
  t.is(exec.lastCall.args[0].trim(), 'npm publish . --tag latest');
  exec.restore();
});

test('should not throw if npm returns 404 for unsupported ping', async t => {
  const npmClient = factory(npm);
  const exec = sinon.stub(npmClient.shell, 'exec').resolves();
  const pingError = 'npm ERR!     <title>404 - No content for path /-/ping</title>';
  exec.withArgs('npm ping').rejects(new Error(pingError));
  await runTasks(npmClient);
  t.is(exec.lastCall.args[0].trim(), 'npm publish . --tag latest');
  exec.restore();
});

test('should throw if user is not authenticated', async t => {
  const npmClient = factory(npm);
  const exec = sinon.stub(npmClient.shell, 'exec').resolves();
  exec.withArgs('npm whoami').rejects();
  await t.throwsAsync(runTasks(npmClient), { message: /Not authenticated with npm/ });
  exec.restore();
});

test('should publish public scoped package as public', async t => {
  const options = { npm: { access: 'public', tag: 'beta' } };
  const npmClient = factory(npm, { options });
  npmClient.setContext({ name: '@scoped/pkg' });
  const exec = sinon.spy(npmClient.shell, 'exec');
  await npmClient.publish();
  t.is(exec.lastCall.args[0].trim(), 'npm publish . --tag beta --access public');
  exec.restore();
});

test('should publish a private scoped package as private', async t => {
  const options = { npm: { access: 'restricted', tag: 'beta' } };
  const npmClient = factory(npm, { options });
  npmClient.setContext({ name: '@scoped/pkg' });
  const exec = sinon.spy(npmClient.shell, 'exec');
  await npmClient.publish();
  t.is(exec.lastCall.args[0].trim(), 'npm publish . --tag beta --access restricted');
  exec.restore();
});

test('should publish a new private scoped package as npm would', async t => {
  const options = { npm: { tag: 'beta' } };
  const npmClient = factory(npm, { options });
  npmClient.setContext({ name: '@scoped/pkg' });
  const exec = sinon.spy(npmClient.shell, 'exec');
  await npmClient.publish();
  t.is(exec.lastCall.args[0].trim(), 'npm publish . --tag beta');
  exec.restore();
});

test('should publish a new public scoped package as public', async t => {
  const options = { npm: { access: 'public', tag: 'beta' } };
  const npmClient = factory(npm, { options });
  npmClient.setContext({ name: '@scoped/pkg' });
  const exec = sinon.spy(npmClient.shell, 'exec');
  await npmClient.publish();
  t.is(exec.lastCall.args[0].trim(), 'npm publish . --tag beta --access public');
  exec.restore();
});

test('should not publish private package', async t => {
  const npmClient = factory(npm);
  npmClient.setContext({ name: 'pkg', private: true });
  const exec = sinon.spy(npmClient.shell, 'exec');
  await npmClient.publish();
  const publish = exec.args.filter(arg => arg[0].startsWith('npm publish'));
  t.is(publish.length, 0);
  t.regex(npmClient.log.warn.lastCall.args[0], /package is private/);
});

test('should handle 2FA and publish with OTP', async t => {
  const npmClient = factory(npm);
  npmClient.setContext({ name: 'pkg' });

  const exec = sinon.stub(npmClient.shell, 'exec');

  exec.onFirstCall().rejects(new Error('Initial error with one-time pass.'));
  exec.onSecondCall().rejects(new Error('The provided one-time pass is incorrect.'));
  exec.onThirdCall().resolves();

  await npmClient.publish({
    otpCallback: () =>
      npmClient.publish({
        otp: '123',
        otpCallback: () => npmClient.publish({ otp: '123456' })
      })
  });

  t.is(exec.callCount, 3);
  t.is(exec.firstCall.args[0].trim(), 'npm publish . --tag latest');
  t.is(exec.secondCall.args[0].trim(), 'npm publish . --tag latest  --otp 123');
  t.is(exec.thirdCall.args[0].trim(), 'npm publish . --tag latest  --otp 123456');

  t.is(npmClient.log.warn.callCount, 1);
  t.is(npmClient.log.warn.firstCall.args[0], 'The provided OTP is incorrect or has expired.');
});

test('should publish', async t => {
  const npmClient = factory(npm);
  const exec = sinon.stub(npmClient.shell, 'exec').resolves();
  await runTasks(npmClient);
  t.is(exec.lastCall.args[0].trim(), 'npm publish . --tag latest');
  exec.restore();
});

test('should skip checks', async t => {
  const options = { npm: { skipChecks: true } };
  const npmClient = factory(npm, { options });
  await t.notThrowsAsync(npmClient.init());
});

test('should publish to a different/scoped registry', async t => {
  delete require.cache[require.resolve('../package.json')];
  mock({
    [path.resolve('package.json')]: JSON.stringify({
      name: '@my-scope/my-pkg',
      version: '1.0.0',
      publishConfig: {
        access: 'public',
        '@my-scope:registry': 'https://gitlab.com/api/v4/projects/my-scope%2Fmy-pkg/packages/npm/'
      }
    })
  });
  const options = { npm };
  const npmClient = factory(npm, { options });
  const exec = sinon.stub(npmClient.shell, 'exec').resolves();

  await runTasks(npmClient);

  t.deepEqual(getArgs(exec.args, 'npm'), [
    'npm ping --registry https://gitlab.com/api/v4/projects/my-scope%2Fmy-pkg/packages/npm/',
    'npm whoami --registry https://gitlab.com/api/v4/projects/my-scope%2Fmy-pkg/packages/npm/',
    'npm show @my-scope/my-pkg@latest version --registry https://gitlab.com/api/v4/projects/my-scope%2Fmy-pkg/packages/npm/',
    'npm version 1.0.1 --no-git-tag-version',
    'npm publish . --tag latest'
  ]);

  exec.restore();
});
