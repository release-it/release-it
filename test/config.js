import test, { describe, before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { isCI } from 'ci-info';
import Config from '../lib/config.js';
import { readJSON } from '../lib/util.js';
import { mockFetch } from './util/mock.js';
import { createTarBlobByRawContents } from './util/fetch.js';

const defaultConfig = readJSON(new URL('../config/release-it.json', import.meta.url));
const projectConfig = readJSON(new URL('../.release-it.json', import.meta.url));

const localConfig = { github: { release: true } };

describe('config', async () => {
  test("should read this project's own configuration", async () => {
    const config = new Config();
    await config.init();
    assert.deepEqual(config.constructorConfig, {});
    assert.deepEqual(config.localConfig, projectConfig);
    assert.deepEqual(config.defaultConfig, defaultConfig);
  });

  test('should contain default values', async () => {
    const config = new Config({ configDir: './test/stub/config/default' });
    await config.init();
    assert.deepEqual(config.constructorConfig, { configDir: './test/stub/config/default' });
    assert.deepEqual(config.localConfig, localConfig);
    assert.deepEqual(config.defaultConfig, defaultConfig);
  });

  test('should merge provided options', async () => {
    const config = new Config({
      configDir: './test/stub/config/merge',
      increment: '1.0.0',
      verbose: true,
      github: {
        release: true
      }
    });
    await config.init();
    const { options } = config;
    assert.equal(config.isVerbose, true);
    assert.equal(config.isDryRun, false);
    assert.equal(options.increment, '1.0.0');
    assert.equal(options.git.push, false);
    assert.equal(options.github.release, true);
  });

  test('should set CI mode', async () => {
    const config = new Config({ ci: true });
    await config.init();
    assert.equal(config.isCI, true);
  });

  test('should detect CI mode', async () => {
    const config = new Config();
    await config.init();
    assert.equal(config.options.ci, isCI);
    assert.equal(config.isCI, isCI);
  });

  test('should override --no-npm.publish', async () => {
    const config = new Config({ npm: { publish: false } });
    await config.init();
    assert.equal(config.options.npm.publish, false);
  });

  test('should read YAML config', async () => {
    const config = new Config({ configDir: './test/stub/config/yaml' });
    await config.init();
    assert.deepEqual(config.options.foo, { bar: 1 });
  });

  test('should read YML config', async () => {
    const config = new Config({ configDir: './test/stub/config/yml' });
    await config.init();
    assert.deepEqual(config.options.foo, { bar: 1 });
  });

  test('should read TOML config', async () => {
    const config = new Config({ configDir: './test/stub/config/toml' });
    await config.init();
    assert.deepEqual(config.options.foo, { bar: 1 });
  });

  test('should throw if provided config file is invalid (cosmiconfig exception)', async () => {
    await assert.rejects(async () => {
      const config = new Config({ config: './test/stub/config/invalid-config-txt' });
      await config.init();
    }, /Invalid configuration file at/);
  });

  test('should throw if provided config file is invalid (no object)', async () => {
    await assert.rejects(async () => {
      const config = new Config({ config: './test/stub/config/invalid-config-rc' });
      await config.init();
    }, /Invalid configuration file at/);
  });

  test('should not set default increment (for CI mode)', async () => {
    const config = new Config({ ci: true });
    await config.init();
    assert.equal(config.options.version.increment, undefined);
  });

  test('should not set default increment (for interactive mode)', async () => {
    const config = new Config({ ci: false });
    await config.init();
    assert.equal(config.options.version.increment, undefined);
  });

  test('should expand pre-release shortcut', async () => {
    const config = new Config({ increment: 'major', preRelease: 'beta' });
    await config.init();
    assert.deepEqual(config.options.version, {
      increment: 'major',
      isPreRelease: true,
      preReleaseBase: undefined,
      preReleaseId: 'beta'
    });
  });

  test('should expand pre-release shortcut (preRelease boolean)', async () => {
    const config = new Config({ ci: true, preRelease: true });
    await config.init();
    assert.deepEqual(config.options.version, {
      increment: undefined,
      isPreRelease: true,
      preReleaseBase: undefined,
      preReleaseId: undefined
    });
  });

  test('should expand pre-release shortcut (without increment)', async () => {
    const config = new Config({ ci: false, preRelease: 'alpha' });
    await config.init();
    assert.deepEqual(config.options.version, {
      increment: undefined,
      isPreRelease: true,
      preReleaseBase: undefined,
      preReleaseId: 'alpha'
    });
  });

  test('should expand pre-release shortcut (including increment and npm.tag)', async () => {
    const config = new Config({ increment: 'minor', preRelease: 'rc' });
    await config.init();
    assert.deepEqual(config.options.version, {
      increment: 'minor',
      isPreRelease: true,
      preReleaseBase: undefined,
      preReleaseId: 'rc'
    });
  });

  test('should use pre-release base', async () => {
    const config = new Config({ increment: 'minor', preRelease: 'next', preReleaseBase: '1' });
    await config.init();
    assert.deepEqual(config.options.version, {
      increment: 'minor',
      isPreRelease: true,
      preReleaseBase: '1',
      preReleaseId: 'next'
    });
  });

  test('should expand pre-release shortcut (snapshot)', async () => {
    const config = new Config({ snapshot: 'feat' });
    await config.init();
    assert.deepEqual(config.options.version, {
      increment: 'prerelease',
      isPreRelease: true,
      preReleaseBase: undefined,
      preReleaseId: 'feat'
    });
    assert.equal(config.options.git.tagMatch, '0.0.0-feat.[0-9]*');
    assert.equal(config.options.git.getLatestTagFromAllRefs, true);
  });
});

describe('fetch extended configuration', () => {
  const [mocker, server] = mockFetch('https://api.github.com');

  before(() => {
    mocker.mockGlobal();
  });

  afterEach(() => {
    mocker.clearAll();
  });

  after(() => {
    mocker.unmockGlobal();
  });

  test('should fetch extended configuration with default file and default branch', async () => {
    const extendedConfiguration = {
      git: {
        commitMessage: 'Released version ${version}'
      }
    };

    server.head('/repos/release-it/release-it-configuration/tarball/main', {
      status: 200,
      headers: {}
    });

    server.get('/repos/release-it/release-it-configuration/tarball/main', {
      status: 200,
      body: await new Response(
        createTarBlobByRawContents({
          '.release-it.json': JSON.stringify(extendedConfiguration)
        })
      ).arrayBuffer()
    });

    const config = new Config({
      extends: 'github:release-it/release-it-configuration'
    });
    await config.init();

    assert(mocker.allRoutesCalled());

    assert.equal(config.options.git.commitMessage, extendedConfiguration.git.commitMessage);
  });

  test('should fetch extended configuration with default file and specific tag', async () => {
    const extendedConfiguration = {
      git: {
        commitMessage: 'Released version ${version}'
      }
    };

    server.head('/repos/release-it/release-it-configuration/tarball/1.0.0', {
      status: 200,
      headers: {}
    });

    server.get('/repos/release-it/release-it-configuration/tarball/1.0.0', {
      status: 200,
      body: await new Response(
        createTarBlobByRawContents({
          '.release-it.json': JSON.stringify(extendedConfiguration)
        })
      ).arrayBuffer()
    });

    const config = new Config({
      extends: 'github:release-it/release-it-configuration#1.0.0'
    });
    await config.init();

    assert(mocker.allRoutesCalled());

    assert.equal(config.options.git.commitMessage, extendedConfiguration.git.commitMessage);
  });

  test('should fetch extended configuration with sub dir and specific tag', async () => {
    const extendedConfiguration = {
      git: {
        commitMessage: 'Released version ${version}'
      }
    };

    const extendedSubConfiguration = {
      git: {
        commitMessage: 'Released pkg version ${version}'
      }
    };

    server.head('/repos/release-it/release-it-configuration/tarball/1.0.0', {
      status: 200,
      headers: {}
    });

    server.get('/repos/release-it/release-it-configuration/tarball/1.0.0', {
      status: 200,
      body: await new Response(
        createTarBlobByRawContents({
          '.release-it.json': JSON.stringify(extendedConfiguration),
          'sub/.release-it.json': JSON.stringify(extendedSubConfiguration)
        })
      ).arrayBuffer()
    });

    const config = new Config({
      extends: 'github:release-it/release-it-configuration/sub#1.0.0'
    });
    await config.init();

    assert(mocker.allRoutesCalled());

    assert.equal(config.options.git.commitMessage, extendedSubConfiguration.git.commitMessage);
  });

  test('should fetch extended configuration with custom file and default branch', async () => {
    const extendedConfiguration = {
      git: {
        commitMessage: 'Released version ${version}'
      }
    };

    const extendedSubConfiguration = {
      git: {
        commitMessage: 'Released pkg version ${version}'
      }
    };

    server.head('/repos/release-it/release-it-configuration/tarball/main', {
      status: 200,
      headers: {}
    });

    server.get('/repos/release-it/release-it-configuration/tarball/main', {
      status: 200,
      body: await new Response(
        createTarBlobByRawContents({
          '.release-it.json': JSON.stringify(extendedConfiguration),
          'sub/.release-it.json': JSON.stringify(extendedSubConfiguration)
        })
      ).arrayBuffer()
    });

    const config = new Config({
      extends: 'github:release-it/release-it-configuration/sub'
    });
    await config.init();

    assert(mocker.allRoutesCalled());

    assert.equal(config.options.git.commitMessage, extendedSubConfiguration.git.commitMessage);
  });
});
