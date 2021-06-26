const path = require('path');
const test = require('ava');
const sinon = require('sinon');
const mock = require('mock-fs');
const npm = require('../lib/plugin/npm/npm');
const { factory, runTasks } = require('./util');
const { getArgs } = require('./util/helpers');

test('should publish a new private scoped package as npm would', async t => {
  const options = { npm: { pnpm: true, tag: 'beta' } };
  const pnpmClient = factory(npm, { options });
  pnpmClient.setContext({ name: '@scoped/pkg' });
  const exec = sinon.spy(pnpmClient.shell, 'exec');
  await pnpmClient.publish();
  t.is(exec.lastCall.args[0].trim(), 'pnpm publish . --tag beta');
  exec.restore();
});

test('should not publish private package', async t => {
  const options = { npm: { pnpm: true } };
  const pnpmClient = factory(npm, { options });
  pnpmClient.setContext({ name: 'pkg', private: true });
  const exec = sinon.spy(pnpmClient.shell, 'exec');
  await pnpmClient.publish();
  const publish = exec.args.filter(arg => arg[0].startsWith('pnpm publish'));
  t.is(publish.length, 0);
  t.regex(pnpmClient.log.warn.lastCall.args[0], /package is private/);
});

test('should publish', async t => {
  const options = { npm: { pnpm: true } };
  const pnpmClient = factory(npm, { options });
  const exec = sinon.stub(pnpmClient.shell, 'exec').resolves();
  exec.withArgs('npm whoami').resolves('berry');
  exec.withArgs('npm access ls-collaborators release-it').resolves(JSON.stringify({ berry: ['write'] }));
  await runTasks(pnpmClient);
  t.is(exec.lastCall.args[0].trim(), 'pnpm publish . --tag latest');
  exec.restore();
});

test('should use extra publish arguments ', async t => {
  const publishArgs = '-r';
  const options = { npm: { pnpm: true, skipChecks: true, publishArgs } };
  const pnpmClient = factory(npm, { options });
  const exec = sinon.stub(pnpmClient.shell, 'exec').resolves();
  await runTasks(pnpmClient);
  t.is(exec.lastCall.args[0].trim(), 'pnpm publish -r . --tag latest');
  exec.restore();
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
  const options = { npm: { pnpm: true } };
  const pnpmClient = factory(npm, { options });
  const exec = sinon.stub(pnpmClient.shell, 'exec').resolves();
  exec
    .withArgs('npm whoami --registry https://gitlab.com/api/v4/projects/my-scope%2Fmy-pkg/packages/npm/')
    .resolves('john');
  exec
    .withArgs(
      'npm access ls-collaborators @my-scope/my-pkg --registry https://gitlab.com/api/v4/projects/my-scope%2Fmy-pkg/packages/npm/'
    )
    .resolves(JSON.stringify({ john: ['write'] }));

  await runTasks(pnpmClient);

  t.deepEqual(getArgs(exec.args, ['npm', 'pnpm']), [
    'npm ping --registry https://gitlab.com/api/v4/projects/my-scope%2Fmy-pkg/packages/npm/',
    'npm whoami --registry https://gitlab.com/api/v4/projects/my-scope%2Fmy-pkg/packages/npm/',
    'npm show @my-scope/my-pkg@latest version --registry https://gitlab.com/api/v4/projects/my-scope%2Fmy-pkg/packages/npm/',
    'npm access ls-collaborators @my-scope/my-pkg --registry https://gitlab.com/api/v4/projects/my-scope%2Fmy-pkg/packages/npm/',
    'npm version 1.0.1 --no-git-tag-version',
    'pnpm publish . --tag latest'
  ]);

  exec.restore();
});
