import { fileURLToPath } from 'node:url';
import test from 'ava';
import { isCI } from 'ci-info';
import sinon from 'sinon';
import Config from '../lib/config.js';
import { readJSON } from '../lib/util.js';
import { createRemoteTarBlob } from './util/fetch.js';

const defaultConfig = readJSON(new URL('../config/release-it.json', import.meta.url));
const projectConfig = readJSON(new URL('../.release-it.json', import.meta.url));

const localConfig = { github: { release: true } };

const fetchStub = sinon.stub(global, 'fetch');

test.serial.afterEach(() => {
  fetchStub.reset();
  fetchStub.restore();
});

test("should read this project's own configuration", async t => {
  const config = new Config();
  await config.resolved;
  t.deepEqual(config.constructorConfig, {});
  t.deepEqual(config.localConfig, projectConfig);
  t.deepEqual(config.defaultConfig, defaultConfig);
});

test('should contain default values', async t => {
  const config = new Config({ configDir: './test/stub/config/default' });
  await config.resolved;
  t.deepEqual(config.constructorConfig, { configDir: './test/stub/config/default' });
  t.deepEqual(config.localConfig, localConfig);
  t.deepEqual(config.defaultConfig, defaultConfig);
});

test('should merge provided options', async t => {
  const config = new Config({
    configDir: './test/stub/config/merge',
    increment: '1.0.0',
    verbose: true,
    github: {
      release: true
    }
  });
  await config.resolved;

  const { options } = config;
  t.is(config.isVerbose, true);
  t.is(config.isDryRun, false);
  t.is(options.increment, '1.0.0');
  t.is(options.git.push, false);
  t.is(options.github.release, true);
});

test('should set CI mode', async t => {
  const config = new Config({ ci: true });
  await config.resolved;

  t.is(config.isCI, true);
});

test('should detect CI mode', async t => {
  const config = new Config();
  await config.resolved;

  t.is(config.options.ci, isCI);
  t.is(config.isCI, isCI);
});

test('should override --no-npm.publish', async t => {
  const config = new Config({ npm: { publish: false } });
  await config.resolved;

  t.is(config.options.npm.publish, false);
});

test('should read YAML config', async t => {
  const config = new Config({ configDir: './test/stub/config/yaml' });
  await config.resolved;

  t.deepEqual(config.options.foo, { bar: 1 });
});

test('should read YML config', async t => {
  const config = new Config({ configDir: './test/stub/config/yml' });
  await config.resolved;

  t.deepEqual(config.options.foo, { bar: 1 });
});

test('should read TOML config', async t => {
  const config = new Config({ configDir: './test/stub/config/toml' });
  await config.resolved;

  t.deepEqual(config.options.foo, { bar: 1 });
});

test('should throw if provided config file is not found', async t => {
  await t.throwsAsync(
    async () => {
      const config = new Config({ config: 'nofile' });
      await config.resolved;
    },
    { message: /no such file.+nofile/ }
  );
});

test('should throw if provided config file is invalid (cosmiconfig exception)', async t => {
  await t.throwsAsync(
    async () => {
      const config = new Config({ config: './test/stub/config/invalid-config-txt' });
      await config.resolved;
    },
    {
      message: /Invalid configuration file at/
    }
  );
});

test('should throw if provided config file is invalid (no object)', async t => {
  await t.throwsAsync(
    async () => {
      const config = new Config({ config: './test/stub/config/invalid-config-rc' });
      await config.resolved;
    },
    {
      message: /Invalid configuration file at/
    }
  );
});

test('should not set default increment (for CI mode)', async t => {
  const config = new Config({ ci: true });
  await config.resolved;

  t.is(config.options.version.increment, undefined);
});

test('should not set default increment (for interactive mode)', async t => {
  const config = new Config({ ci: false });
  await config.resolved;

  t.is(config.options.version.increment, undefined);
});

test('should expand pre-release shortcut', async t => {
  const config = new Config({ increment: 'major', preRelease: 'beta' });
  await config.resolved;

  t.deepEqual(config.options.version, {
    increment: 'major',
    isPreRelease: true,
    preReleaseBase: undefined,
    preReleaseId: 'beta'
  });
});

test('should expand pre-release shortcut (preRelease boolean)', async t => {
  const config = new Config({ ci: true, preRelease: true });
  await config.resolved;

  t.deepEqual(config.options.version, {
    increment: undefined,
    isPreRelease: true,
    preReleaseBase: undefined,
    preReleaseId: undefined
  });
});

test('should expand pre-release shortcut (without increment)', async t => {
  const config = new Config({ ci: false, preRelease: 'alpha' });
  await config.resolved;

  t.deepEqual(config.options.version, {
    increment: undefined,
    isPreRelease: true,
    preReleaseBase: undefined,
    preReleaseId: 'alpha'
  });
});

test('should expand pre-release shortcut (including increment and npm.tag)', async t => {
  const config = new Config({ increment: 'minor', preRelease: 'rc' });
  await config.resolved;

  t.deepEqual(config.options.version, {
    increment: 'minor',
    isPreRelease: true,
    preReleaseBase: undefined,
    preReleaseId: 'rc'
  });
});

test('should use pre-release base', async t => {
  const config = new Config({ increment: 'minor', preRelease: 'next', preReleaseBase: '1' });
  await config.resolved;

  t.deepEqual(config.options.version, {
    increment: 'minor',
    isPreRelease: true,
    preReleaseBase: '1',
    preReleaseId: 'next'
  });
});

test('should expand pre-release shortcut (snapshot)', async t => {
  const config = new Config({ snapshot: 'feat' });
  await config.resolved;

  t.deepEqual(config.options.version, {
    increment: 'prerelease',
    isPreRelease: true,
    preReleaseBase: undefined,
    preReleaseId: 'feat'
  });
  t.is(config.options.git.tagMatch, '0.0.0-feat.[0-9]*');
  t.true(config.options.git.getLatestTagFromAllRefs);
});

test.serial('should fetch extended configuration with default file and default branch', async t => {
  fetchStub.onCall(0).resolves({
    ok: true,
    headers: new Headers()
  });

  fetchStub.onCall(1).resolves({
    ok: true,
    body: createRemoteTarBlob(fileURLToPath(new URL('./stub/config/remote', import.meta.url)))
  });

  const config = new Config({
    extends: 'github:release-it/release-it-configuration'
  });
  await config.resolved;

  t.is(fetchStub.firstCall?.firstArg, 'https://api.github.com/repos/release-it/release-it-configuration/tarball/main');

  t.is(config.options.git?.commitMessage, 'Released version ${version}');

  fetchStub.restore();
});

test.serial('should fetch extended configuration with default file and specific tag', async t => {
  fetchStub.onCall(0).resolves({
    ok: true,
    headers: new Headers()
  });

  fetchStub.onCall(1).resolves({
    ok: true,
    body: createRemoteTarBlob(fileURLToPath(new URL('./stub/config/remote', import.meta.url)))
  });

  const config = new Config({
    extends: 'github:release-it/release-it-configuration#1.0.0'
  });
  await config.resolved;

  t.is(fetchStub.firstCall?.firstArg, 'https://api.github.com/repos/release-it/release-it-configuration/tarball/1.0.0');

  t.is(config.options.git?.commitMessage, 'Released version ${version}');

  fetchStub.restore();
});

test.serial('should fetch extended configuration with subdir and specific tag', async t => {
  fetchStub.onCall(0).resolves({
    ok: true,
    headers: new Headers()
  });

  fetchStub.onCall(1).resolves({
    ok: true,
    body: createRemoteTarBlob(fileURLToPath(new URL('./stub/config/remote', import.meta.url)))
  });

  const config = new Config({
    extends: 'github:release-it/release-it-configuration/sub#1.0.0'
  });
  await config.resolved;

  t.is(fetchStub.firstCall?.firstArg, 'https://api.github.com/repos/release-it/release-it-configuration/tarball/1.0.0');

  t.is(config.options.git?.commitMessage, 'Released with version ${version}');

  fetchStub.restore();
});

test.serial('should fetch extended configuration with custom file and default branch', async t => {
  fetchStub.onCall(0).resolves({
    ok: true,
    headers: new Headers()
  });

  fetchStub.onCall(1).resolves({
    ok: true,
    body: createRemoteTarBlob(fileURLToPath(new URL('./stub/config/remote', import.meta.url)))
  });

  const config = new Config({
    extends: 'github:release-it/release-it-configuration/sub'
  });
  await config.resolved;

  t.is(fetchStub.firstCall?.firstArg, 'https://api.github.com/repos/release-it/release-it-configuration/tarball/main');

  t.is(config.options.git?.commitMessage, 'Released with version ${version}');

  fetchStub.restore();
});
