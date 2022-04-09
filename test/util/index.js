import _ from 'lodash';
import sinon from 'sinon';
import semver from 'semver';
import { parseVersion } from '../../lib/util.js';
import Log from '../../lib/log.js';
import Config from '../../lib/config.js';
import ShellStub from '../stub/shell.js';
import Spinner from '../../lib/spinner.js';
import Prompt from '../../lib/prompt.js';

export let factory = (Definition, { namespace, options = {}, container = {} } = {}) => {
  _.defaults(options, { ci: true, verbose: false, 'dry-run': false, debug: false });

  const ns = namespace || Definition.name.toLowerCase();

  container.config = container.config || new Config(Object.assign({ config: false }, options));
  container.log = container.log || sinon.createStubInstance(Log);

  const spinner = container.spinner || sinon.createStubInstance(Spinner);
  spinner.show.callsFake(({ enabled = true, task }) => (enabled ? task() : () => {}));
  container.spinner = spinner;
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
