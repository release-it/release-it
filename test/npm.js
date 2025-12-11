import { join } from 'node:path';
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import npm from '../lib/plugin/npm/npm.js';
import { factory, runTasks } from './util/index.js';
import { mkTmpDir, getArgs } from './util/helpers.js';

describe('npm', async () => {
  test('should return npm package url', async () => {
    const options = { npm: { name: 'my-cool-package' } };
    const npmClient = await factory(npm, { options });
    assert.equal(npmClient.getPackageUrl(), 'https://www.npmjs.com/package/my-cool-package');
  });

  test('should return npm package url (custom registry)', async () => {
    const options = { npm: { name: 'my-cool-package', publishConfig: { registry: 'https://registry.example.org/' } } };
    const npmClient = await factory(npm, { options });
    assert.equal(npmClient.getPackageUrl(), 'https://registry.example.org/package/my-cool-package');
  });

  test('should return npm package url (custom publicPath)', async () => {
    const options = { npm: { name: 'my-cool-package', publishConfig: { publicPath: '/custom/public-path' } } };
    const npmClient = await factory(npm, { options });
    assert.equal(npmClient.getPackageUrl(), 'https://www.npmjs.com/custom/public-path/my-cool-package');
  });

  test('should return npm package url (custom registry and publicPath)', async () => {
    const options = {
      npm: {
        name: 'my-cool-package',
        publishConfig: { registry: 'https://registry.example.org/', publicPath: '/custom/public-path' }
      }
    };
    const npmClient = await factory(npm, { options });
    assert.equal(npmClient.getPackageUrl(), 'https://registry.example.org/custom/public-path/my-cool-package');
  });

  test('should return default tag', async () => {
    const npmClient = await factory(npm);
    const tag = await npmClient.resolveTag();
    assert.equal(tag, 'latest');
  });

  test('should resolve default tag for pre-release', async t => {
    const npmClient = await factory(npm);
    t.mock.method(npmClient, 'getRegistryPreReleaseTags', () => []);
    const tag = await npmClient.resolveTag('1.0.0-0');
    assert.equal(tag, 'next');
  });

  test('should guess tag from registry for pre-release', async t => {
    const npmClient = await factory(npm);
    t.mock.method(npmClient, 'getRegistryPreReleaseTags', () => ['alpha']);
    const tag = await npmClient.resolveTag('1.0.0-0');
    assert.equal(tag, 'alpha');
  });

  test('should derive tag from pre-release version', async () => {
    const npmClient = await factory(npm);
    const tag = await npmClient.resolveTag('1.0.2-alpha.3');
    assert.equal(tag, 'alpha');
  });

  test('should use provided (default) tag even for pre-release', async t => {
    const options = { npm: { tag: 'latest' } };
    const npmClient = await factory(npm, { options });
    t.mock.method(npmClient.shell, 'exec', () => Promise.resolve());
    await npmClient.bump('1.0.0-next.0');
    assert.equal(npmClient.getContext('tag'), 'latest');
  });

  test('should throw when `npm version` fails', async t => {
    const npmClient = await factory(npm);
    t.mock.method(npmClient.shell, 'exec', () =>
      Promise.reject(new Error('npm ERR! Version not changed, might want --allow-same-version'))
    );
    await assert.rejects(npmClient.bump('1.0.0-next.0'), { message: /Version not changed/ });
  });

  test('should return first pre-release tag from package in registry when resolving tag without pre-id', async t => {
    const npmClient = await factory(npm);
    const response = { latest: '1.4.1', alpha: '2.0.0-alpha.1', beta: '2.0.0-beta.3' };
    t.mock.method(npmClient.shell, 'exec', () => Promise.resolve(JSON.stringify(response)));
    assert.equal(await npmClient.resolveTag('2.0.0-5'), 'alpha');
  });

  test('should return default pre-release tag when resolving tag without pre-id', async t => {
    const npmClient = await factory(npm);
    const response = {
      latest: '1.4.1'
    };
    t.mock.method(npmClient.shell, 'exec', () => Promise.resolve(JSON.stringify(response)));
    assert.equal(await npmClient.resolveTag('2.0.0-0'), 'next');
  });

  test('should handle erroneous output when resolving tag without pre-id', async t => {
    const npmClient = await factory(npm);
    t.mock.method(npmClient.shell, 'exec', () => Promise.resolve(''));
    assert.equal(await npmClient.resolveTag('2.0.0-0'), 'next');
  });

  test('should handle errored request when resolving tag without pre-id', async t => {
    const npmClient = await factory(npm);
    t.mock.method(npmClient.shell, 'exec', () => Promise.resolve());
    assert.equal(await npmClient.resolveTag('2.0.0-0'), 'next');
  });

  test('should add registry to commands when specified', async t => {
    const npmClient = await factory(npm);
    npmClient.setContext({ publishConfig: { registry: 'registry.example.org' } });
    const exec = t.mock.method(npmClient.shell, 'exec', command => {
      if (command === 'npm whoami --registry registry.example.org') return Promise.resolve('john');
      const re = /npm access (list collaborators --json|ls-collaborators) release-it --registry registry.example.org/;
      if (re.test.command) return Promise.resolve(JSON.stringify({ john: ['write'] }));
      return Promise.resolve();
    });

    await runTasks(npmClient);
    assert.equal(exec.mock.calls[0].arguments[0], 'npm ping --registry registry.example.org');
    assert.equal(exec.mock.calls[1].arguments[0], 'npm whoami --registry registry.example.org');
    assert.match(
      exec.mock.calls[2].arguments[0],
      /npm show release-it@[a-z]+ version --registry registry\.example\.org/
    );
  });

  test('should not throw when executing tasks', async t => {
    const npmClient = await factory(npm);
    t.mock.method(npmClient.shell, 'exec', command => {
      if (command === 'npm whoami') return Promise.resolve('john');
      const re = /npm access (list collaborators --json|ls-collaborators) release-it/;
      if (re.test.command) return Promise.resolve(JSON.stringify({ john: ['write'] }));
      return Promise.resolve();
    });
    await assert.doesNotReject(runTasks(npmClient));
  });

  test('should throw if npm is down', async t => {
    const npmClient = await factory(npm);
    t.mock.method(npmClient.shell, 'exec', command => {
      if (command === 'npm ping') return Promise.reject();
      return Promise.resolve();
    });
    await assert.rejects(runTasks(npmClient), { message: /^Unable to reach npm registry/ });
  });

  test('should not throw if npm returns 400/404 for unsupported ping/whoami/access', async t => {
    const npmClient = await factory(npm);
    const exec = t.mock.method(npmClient.shell, 'exec', () => Promise.resolve());
    const pingError = "npm ERR! code E404\nnpm ERR! 404 Package '--ping' not found : ping";
    const whoamiError = "npm ERR! code E404\nnpm ERR! 404 Package '--whoami' not found : whoami";
    const accessError = 'npm ERR! code E400\nnpm ERR! 400 Bad Request - GET https://npm.example.org/-/collaborators';
    exec.mock.mockImplementationOnce(() => Promise.reject(new Error(pingError)), 0);
    exec.mock.mockImplementationOnce(() => Promise.reject(new Error(whoamiError)), 1);
    exec.mock.mockImplementationOnce(() => Promise.reject(new Error(accessError)), 2);
    await runTasks(npmClient);
    assert.deepEqual(exec.mock.calls.at(-1).arguments[0], [
      'npm',
      'publish',
      '.',
      '--tag',
      'latest',
      '--workspaces=false'
    ]);
  });

  test('should not throw if npm returns 400 for unsupported ping/whoami/access', async t => {
    const npmClient = await factory(npm);
    const exec = t.mock.method(npmClient.shell, 'exec', () => Promise.resolve());
    const pingError = 'npm ERR! code E400\nnpm ERR! 400 Bad Request - GET https://npm.example.org/-/ping?write=true';
    const whoamiError = 'npm ERR! code E400\nnpm ERR! 400 Bad Request - GET https://npm.example.org/-/whoami';
    const accessError = 'npm ERR! code E400\nnpm ERR! 400 Bad Request - GET https://npm.example.org/-/collaborators';
    exec.mock.mockImplementationOnce(() => Promise.reject(new Error(pingError)), 0);
    exec.mock.mockImplementationOnce(() => Promise.reject(new Error(whoamiError)), 1);
    exec.mock.mockImplementationOnce(() => Promise.reject(new Error(accessError)), 2);
    await runTasks(npmClient);
    assert.deepEqual(exec.mock.calls.at(-1).arguments[0], [
      'npm',
      'publish',
      '.',
      '--tag',
      'latest',
      '--workspaces=false'
    ]);
  });

  test('should throw if user is not authenticated', async t => {
    const npmClient = await factory(npm);
    const exec = t.mock.method(npmClient.shell, 'exec', () => Promise.resolve());
    exec.mock.mockImplementationOnce(() => Promise.reject(), 1);
    await assert.rejects(runTasks(npmClient), { message: /^Not authenticated with npm/ });
  });

  test('should throw if user is not a collaborator (v9)', async t => {
    const npmClient = await factory(npm);
    t.mock.method(npmClient.shell, 'exec', command => {
      if (command === 'npm whoami') return Promise.resolve('ada');
      if (command === 'npm --version') return Promise.resolve('9.2.0');
      if (command === 'npm access list collaborators --json release-it')
        return Promise.resolve(JSON.stringify({ john: ['write'] }));
      return Promise.resolve();
    });
    await assert.rejects(runTasks(npmClient), { message: /^User ada is not a collaborator for release-it/ });
  });

  test('should throw if user is not a collaborator (v8)', async t => {
    const npmClient = await factory(npm);

    t.mock.method(npmClient.shell, 'exec', command => {
      if (command === 'npm whoami') return Promise.resolve('ada');
      if (command === 'npm --version') return Promise.resolve('8.2.0');
      const re = /npm access (list collaborators --json|ls-collaborators) release-it/;
      if (re.test(command)) return Promise.resolve(JSON.stringify({ john: ['write'] }));
      return Promise.resolve();
    });

    await assert.rejects(runTasks(npmClient), { message: /^User ada is not a collaborator for release-it/ });
  });

  test('should not throw if user is not a collaborator on a new package', async t => {
    const npmClient = await factory(npm);

    t.mock.method(npmClient.shell, 'exec', command => {
      if (command === 'npm whoami') return Promise.resolve('ada');
      const re = /npm access (list collaborators --json|ls-collaborators) release-it/;
      const message =
        'npm ERR! code E404\nnpm ERR! 404 Not Found - GET https://registry.npmjs.org/-/package/release-it/collaborators?format=cli - File not found';
      if (re.test(command)) return Promise.reject(new Error(message));
      return Promise.resolve();
    });

    await assert.doesNotReject(runTasks(npmClient));
  });

  test('should handle 2FA and publish with OTP', async t => {
    const npmClient = await factory(npm);
    npmClient.setContext({ name: 'pkg' });

    const exec = t.mock.method(npmClient.shell, 'exec');

    exec.mock.mockImplementationOnce(() => Promise.reject(new Error('Initial error with one-time pass.')), 0);
    exec.mock.mockImplementationOnce(() => Promise.reject(new Error('The provided one-time pass is incorrect.')), 1);
    exec.mock.mockImplementationOnce(() => Promise.resolve(), 2);

    await npmClient.publish({
      otpCallback: () =>
        npmClient.publish({
          otp: '123',
          otpCallback: () => npmClient.publish({ otp: '123456' })
        })
    });

    assert.equal(exec.mock.callCount(), 3);
    assert.deepEqual(exec.mock.calls[0].arguments[0], ['npm', 'publish', '.', '--tag', 'latest', '--workspaces=false']);
    assert.deepEqual(exec.mock.calls[1].arguments[0], [
      'npm',
      'publish',
      '.',
      '--tag',
      'latest',
      '--workspaces=false',
      '--otp',
      '123'
    ]);
    assert.deepEqual(exec.mock.calls[2].arguments[0], [
      'npm',
      'publish',
      '.',
      '--tag',
      'latest',
      '--workspaces=false',
      '--otp',
      '123456'
    ]);

    assert.equal(npmClient.log.warn.mock.callCount(), 1);
    assert.equal(npmClient.log.warn.mock.calls[0].arguments[0], 'The provided OTP is incorrect or has expired.');
  });

  test('should publish', async t => {
    const npmClient = await factory(npm);
    const exec = t.mock.method(npmClient.shell, 'exec', command => {
      if (command === 'npm whoami') return Promise.resolve('john');
      const re = /npm access (list collaborators --json|ls-collaborators) release-it/;
      if (re.test(command)) return Promise.resolve(JSON.stringify({ john: ['write'] }));
      return Promise.resolve();
    });
    await runTasks(npmClient);
    assert.deepEqual(exec.mock.calls.at(-1).arguments[0], [
      'npm',
      'publish',
      '.',
      '--tag',
      'latest',
      '--workspaces=false'
    ]);
  });

  test('should use extra publish arguments', async t => {
    const options = { npm: { skipChecks: true, publishArgs: '--registry=http://my-internal-registry.local' } };
    const npmClient = await factory(npm, { options });
    const exec = t.mock.method(npmClient.shell, 'exec', () => Promise.resolve());
    await runTasks(npmClient);
    assert.deepEqual(exec.mock.calls.at(-1).arguments[0], [
      'npm',
      'publish',
      '.',
      '--tag',
      'latest',
      '--workspaces=false',
      '--registry=http://my-internal-registry.local'
    ]);
  });

  test('should skip checks', async () => {
    const options = { npm: { skipChecks: true } };
    const npmClient = await factory(npm, { options });
    await assert.doesNotReject(npmClient.init());
  });

  test('should publish to a different/scoped registry', async t => {
    const tmp = mkTmpDir();
    process.chdir(tmp);
    writeFileSync(
      join(tmp, 'package.json'),
      JSON.stringify({
        name: '@my-scope/my-pkg',
        version: '1.0.0',
        publishConfig: {
          access: 'public',
          '@my-scope:registry': 'https://gitlab.com/api/v4/projects/my-scope%2Fmy-pkg/packages/npm/'
        }
      })
    );
    const options = { npm };
    const npmClient = await factory(npm, { options });
    const exec = t.mock.method(npmClient.shell, 'exec', command => {
      const cmd = 'npm whoami --registry https://gitlab.com/api/v4/projects/my-scope%2Fmy-pkg/packages/npm/';
      if (command === cmd) return Promise.resolve('john');
      const re =
        /npm access (list collaborators --json|ls-collaborators) @my-scope\/my-pkg --registry https:\/\/gitlab\.com\/api\/v4\/projects\/my-scope%2Fmy-pkg\/packages\/npm\//;
      if (re.test(command)) return Promise.resolve(JSON.stringify({ john: ['write'] }));
      return Promise.resolve();
    });
    await runTasks(npmClient);

    assert.deepEqual(getArgs(exec, 'npm'), [
      'npm ping --registry https://gitlab.com/api/v4/projects/my-scope%2Fmy-pkg/packages/npm/',
      'npm whoami --registry https://gitlab.com/api/v4/projects/my-scope%2Fmy-pkg/packages/npm/',
      'npm show @my-scope/my-pkg@latest version --registry https://gitlab.com/api/v4/projects/my-scope%2Fmy-pkg/packages/npm/',
      'npm --version',
      'npm version 1.0.1 --no-git-tag-version --workspaces=false',
      'npm publish . --tag latest --workspaces=false --registry https://gitlab.com/api/v4/projects/my-scope%2Fmy-pkg/packages/npm/'
    ]);
  });

  test('should not publish when `npm version` fails', async t => {
    const tmp = mkTmpDir();
    process.chdir(tmp);
    writeFileSync(join(tmp, 'package.json'), JSON.stringify({ name: '@my-scope/my-pkg', version: '1.0.0' }));
    const options = { npm };
    const npmClient = await factory(npm, { options });

    const exec = t.mock.method(npmClient.shell, 'exec', command => {
      if (command === 'npm whoami') return Promise.resolve('john');
      const re = /npm access (list collaborators --json|ls-collaborators) @my-scope\/my-pkg/;
      if (re.test(command)) return Promise.resolve(JSON.stringify({ john: ['write'] }));
      if (command === 'npm version 1.0.1 --no-git-tag-version --workspaces=false')
        return Promise.reject('npm ERR! Version not changed, might want --allow-same-version');
      return Promise.resolve();
    });

    await assert.rejects(runTasks(npmClient), /Version not changed/);

    assert.deepEqual(getArgs(exec, 'npm'), [
      'npm ping',
      'npm whoami',
      'npm show @my-scope/my-pkg@latest version',
      'npm --version',
      'npm version 1.0.1 --no-git-tag-version --workspaces=false'
    ]);
  });

  test('should add allow-same-version argument', async t => {
    const options = { npm: { skipChecks: true, allowSameVersion: true } };
    const npmClient = await factory(npm, { options });

    const exec = t.mock.method(npmClient.shell, 'exec', () => Promise.resolve());

    await runTasks(npmClient);
    const versionArgs = getArgs(exec, 'npm version');
    assert.match(versionArgs[0], / --allow-same-version/);
  });

  test('should add version arguments', async t => {
    const options = { npm: { skipChecks: true, versionArgs: ['--workspaces-update=false', '--allow-same-version'] } };
    const npmClient = await factory(npm, { options });
    const exec = t.mock.method(npmClient.shell, 'exec', () => Promise.resolve());
    await runTasks(npmClient);
    const versionArgs = getArgs(exec, 'npm version');
    assert.match(versionArgs[0], / --workspaces-update=false --allow-same-version/);
  });
});
