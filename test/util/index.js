import { mock } from 'node:test';
import semver from 'semver';
import { parseVersion } from '../../lib/util.js';
import Config from '../../lib/config.js';
import ShellStub from '../stub/shell.js';
import Prompt from '../../lib/prompt.js';

const noop = Promise.resolve();

export class LogStub {
  constructor() {
    this.log = mock.fn();
    this.error = mock.fn();
    this.info = mock.fn();
    this.warn = mock.fn();
    this.verbose = mock.fn();
    this.exec = mock.fn();
    this.obtrusive = mock.fn();
    this.preview = mock.fn();
  }
  resetCalls() {
    this.log.mock.resetCalls();
    this.error.mock.resetCalls();
    this.info.mock.resetCalls();
    this.warn.mock.resetCalls();
    this.verbose.mock.resetCalls();
    this.exec.mock.resetCalls();
    this.obtrusive.mock.resetCalls();
    this.preview.mock.resetCalls();
  }
}

export class SpinnerStub {
  show({ enabled = true, task }) {
    return enabled ? task() : noop;
  }
}

export let factory = async (Definition, { namespace, options = {}, container = {} } = {}) => {
  options = Object.assign({}, { ci: true, verbose: false, 'dry-run': false, debug: false }, options);
  const ns = namespace || Definition.name.toLowerCase();
  container.config = container.config || new Config(Object.assign({ config: false }, options));
  container.log = new LogStub();
  await container.config.init();

  container.spinner = new SpinnerStub();
  container.shell = container.shell || new ShellStub({ container });

  container.prompt = container.prompt || new Prompt({ container });
  container.shell.cache = { set: () => {}, has: () => false };

  return new Definition({
    namespace: ns,
    options,
    container
  });
};

const getIncrement = plugin =>
  plugin.getIncrement(plugin.options) || plugin.getContext('increment') || plugin.config.getContext('increment');

const getVersion = async (plugin, options) => {
  const { latestVersion, increment } = options;
  return (
    (await plugin.getIncrementedVersionCI(options)) ||
    (await plugin.getIncrementedVersion(options)) ||
    (increment !== false ? semver.inc(latestVersion, increment || 'patch') : latestVersion)
  );
};

export let runTasks = async plugin => {
  await plugin.init();

  const name = (await plugin.getName()) || '__test__';
  const latestVersion = (await plugin.getLatestVersion()) || '1.0.0';
  const latestTag = plugin.config.getContext('latestTag');
  const changelog = (await plugin.getChangelog(latestVersion)) || null;
  const increment = getIncrement(plugin);

  plugin.config.setContext({ name, latestVersion, latestTag, changelog });

  const { preRelease } = plugin.config.options;
  const isPreRelease = Boolean(preRelease);
  const preReleaseId = typeof preRelease === 'string' ? preRelease : null;
  const version = await getVersion(plugin, { latestVersion, increment, isPreRelease, preReleaseId });

  plugin.config.setContext(parseVersion(version));

  await plugin.beforeBump();
  await plugin.bump(version);

  const tagName = plugin.config.getContext('tagName') || version;
  plugin.config.setContext({ tagName });

  await plugin.beforeRelease();
  await plugin.release();
  await plugin.afterRelease();

  return {
    name,
    latestVersion,
    version
  };
};
