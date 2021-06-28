const path = require('path');
const test = require('ava');
const sinon = require('sinon');
const mock = require('mock-fs');
const npm = require('../lib/plugin/npm/npm');
const { factory, runTasks } = require('./util');
const { getArgs } = require('./util/helpers');

test('should throw when `npm version` fails', async t => {
  const options = { npm: { yarn: true } };
  const yarnClient = factory(npm, { options });
  const exec = sinon
    .stub(yarnClient.shell, 'exec')
    .rejects(new Error('npm ERR! Version not changed, might want --allow-same-version'));

  await t.throwsAsync(yarnClient.bump('1.0.0-next.0'), { message: /Version not changed/ });

  exec.restore();
});

test('should not throw when executing tasks', async t => {
  const options = { npm: { yarn: true } };
  const yarnClient = factory(npm, { options });
  const exec = sinon.stub(yarnClient.shell, 'exec').resolves();
  exec.withArgs('yarn npm whoami --publish').resolves('berry');
  exec.withArgs('npm access ls-collaborators release-it').resolves(JSON.stringify({ berry: ['write'] }));
  await t.notThrowsAsync(runTasks(yarnClient));
  exec.restore();
});

test('should publish a new private scoped package as npm would', async t => {
  const options = { npm: { yarn: true, tag: 'beta' } };
  const yarnClient = factory(npm, { options });
  yarnClient.setContext({ name: '@scoped/pkg' });
  const exec = sinon.spy(yarnClient.shell, 'exec');
  await yarnClient.publish();
  t.is(exec.lastCall.args[0].trim(), 'yarn npm publish --tag beta');
  exec.restore();
});

test('should not publish private package', async t => {
  const options = { npm: { yarn: true } };
  const yarnClient = factory(npm, { options });
  yarnClient.setContext({ name: 'pkg', private: true });
  const exec = sinon.spy(yarnClient.shell, 'exec');
  await yarnClient.publish();
  const publish = exec.args.filter(arg => arg[0].startsWith('yarn npm publish'));
  t.is(publish.length, 0);
  t.regex(yarnClient.log.warn.lastCall.args[0], /package is private/);
});

test('should publish', async t => {
  const options = { npm: { yarn: true } };
  const yarnClient = factory(npm, { options });
  const exec = sinon.stub(yarnClient.shell, 'exec').resolves();
  exec.withArgs('yarn npm whoami --publish').resolves('berry');
  exec.withArgs('npm access ls-collaborators release-it').resolves(JSON.stringify({ berry: ['write'] }));
  await runTasks(yarnClient);
  t.is(exec.lastCall.args[0].trim(), 'yarn npm publish --tag latest');
  exec.restore();
});

test('should use extra publish arguments', async t => {
  const publishArgs = '--tolerate-republish';
  const options = { npm: { yarn: true, skipChecks: true, publishArgs } };
  const yarnClient = factory(npm, { options });
  const spy = sinon.spy(yarnClient.shell, 'exec');
  await runTasks(yarnClient);
  t.is(spy.lastCall.args[0].trim(), 'yarn npm publish --tag latest --tolerate-republish');
  spy.restore();
});

test('should skip checks', async t => {
  const options = { npm: { yarn: true, skipChecks: true } };
  const yarnClient = factory(npm, { options });
  await t.notThrowsAsync(yarnClient.init());
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
  const options = { npm: { yarn: true } };
  const yarnClient = factory(npm, { options });
  const exec = sinon.stub(yarnClient.shell, 'exec').resolves();
  exec.withArgs('yarn npm whoami --publish').resolves('john');
  exec
    .withArgs(
      'npm access ls-collaborators @my-scope/my-pkg --registry https://gitlab.com/api/v4/projects/my-scope%2Fmy-pkg/packages/npm/'
    )
    .resolves(JSON.stringify({ john: ['write'] }));

  await runTasks(yarnClient);

  t.deepEqual(getArgs(exec.args, ['npm', 'yarn']), [
    'npm ping --registry https://gitlab.com/api/v4/projects/my-scope%2Fmy-pkg/packages/npm/',
    'yarn npm whoami --publish',
    'npm show @my-scope/my-pkg@latest version --registry https://gitlab.com/api/v4/projects/my-scope%2Fmy-pkg/packages/npm/',
    'npm access ls-collaborators @my-scope/my-pkg --registry https://gitlab.com/api/v4/projects/my-scope%2Fmy-pkg/packages/npm/',
    'yarn version 1.0.1 --no-git-tag-version',
    'yarn npm publish --tag latest'
  ]);

  exec.restore();
});

test('should not publish when `npm version` fails', async t => {
  delete require.cache[require.resolve('../package.json')];
  mock({
    [path.resolve('package.json')]: JSON.stringify({
      name: '@my-scope/my-pkg',
      version: '1.0.0'
    })
  });
  const options = { npm: { yarn: true } };
  const yarnClient = factory(npm, { options });
  const exec = sinon.stub(yarnClient.shell, 'exec').resolves();
  exec.withArgs('yarn npm whoami --publish').resolves('john');
  exec.withArgs('npm access ls-collaborators @my-scope/my-pkg').resolves(JSON.stringify({ john: ['write'] }));
  exec.withArgs('yarn version 1.0.1').rejects('npm ERR! Version not changed, might want --allow-same-version');

  try {
    await runTasks(yarnClient);
  } catch (error) {
    t.regex(error.toString(), /Version not changed/);
  }

  t.deepEqual(getArgs(exec.args, ['npm', 'yarn']), [
    'npm ping',
    'yarn npm whoami --publish',
    'npm show @my-scope/my-pkg@latest version',
    'npm access ls-collaborators @my-scope/my-pkg',
    'yarn version 1.0.1 --no-git-tag-version'
  ]);

  exec.restore();
});
