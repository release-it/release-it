import _ from 'lodash';
import { getPlugins } from './plugin/factory.js';
import Logger from './log.js';
import Config from './config.js';
import Shell from './shell.js';
import Prompt from './prompt.js';
import Spinner from './spinner.js';
import { reduceUntil, parseVersion } from './util.js';

const runTasks = async (opts, di) => {
  let container = {};

  try {
    Object.assign(container, di);
    container.config = container.config || new Config(opts);

    const { config } = container;
    const { isCI, isVerbose, verbosityLevel, isDryRun, isChangelog, isReleaseVersion } = config;

    container.log = container.log || new Logger({ isCI, isVerbose, verbosityLevel, isDryRun });
    container.spinner = container.spinner || new Spinner({ container, config });
    container.prompt = container.prompt || new Prompt({ container: { config } });
    container.shell = container.shell || new Shell({ container });

    const { log, shell, spinner } = container;

    const options = config.getContext();

    const { hooks } = options;

    const runHook = async (...name) => {
      const scripts = hooks[name.join(':')];
      if (!scripts || !scripts.length) return;
      const context = config.getContext();
      const external = true;
      for (const script of _.castArray(scripts)) {
        const task = () => shell.exec(script, { external }, context);
        await spinner.show({ task, label: script, context, external });
      }
    };

    const runLifeCycleHook = async (plugin, name, ...args) => {
      if (plugin === _.first(plugins)) await runHook('before', name);
      await runHook('before', plugin.namespace, name);
      const willHookRun = (await plugin[name](...args)) !== false;
      if (willHookRun) {
        await runHook('after', plugin.namespace, name);
      }
      if (plugin === _.last(plugins)) await runHook('after', name);
    };

    const [internal, external] = await getPlugins(config, container);
    let plugins = [...external, ...internal];

    for (const plugin of plugins) {
      await runLifeCycleHook(plugin, 'init');
    }

    const { increment, isPreRelease, preReleaseId } = options.version;

    const name = await reduceUntil(plugins, plugin => plugin.getName());
    const latestVersion = (await reduceUntil(plugins, plugin => plugin.getLatestVersion())) || '0.0.0';
    const changelog = await reduceUntil(plugins, plugin => plugin.getChangelog(latestVersion));

    if (isChangelog) {
      console.log(changelog);
      process.exit(0);
    }

    const incrementBase = { latestVersion, increment, isPreRelease, preReleaseId };

    let version;
    if (config.isIncrement) {
      incrementBase.increment = await reduceUntil(plugins, plugin => plugin.getIncrement(incrementBase));
      version = await reduceUntil(plugins, plugin => plugin.getIncrementedVersionCI(incrementBase));
    } else {
      version = latestVersion;
    }

    config.setContext({ name, latestVersion, version, changelog });

    if (!isReleaseVersion) {
      const action = config.isIncrement ? 'release' : 'update';
      const suffix = version && config.isIncrement ? `${latestVersion}...${version}` : `currently at ${latestVersion}`;
      log.obtrusive(`🚀 Let's ${action} ${name} (${suffix})`);
      log.preview({ title: 'changelog', text: changelog });
    }

    if (config.isIncrement) {
      version = version || (await reduceUntil(plugins, plugin => plugin.getIncrementedVersion(incrementBase)));
    }

    if (!version) {
      log.obtrusive(`No new version to release`);
    }

    if (isReleaseVersion) {
      console.log(version);
      process.exit(0);
    }

    if (version) {
      config.setContext(parseVersion(version));

      if (config.isPromptOnlyVersion) {
        config.setCI(true);
      }

      for (const hook of ['beforeBump', 'bump', 'beforeRelease']) {
        for (const plugin of plugins) {
          const args = hook === 'bump' ? [version] : [];
          await runLifeCycleHook(plugin, hook, ...args);
        }
      }

      plugins = [...internal, ...external];

      for (const hook of ['release', 'afterRelease']) {
        for (const plugin of plugins) {
          await runLifeCycleHook(plugin, hook);
        }
      }
    }

    log.log(`🏁 Done (in ${Math.floor(process.uptime())}s.)`);

    return {
      name,
      changelog,
      latestVersion,
      version
    };
  } catch (err) {
    const { log } = container;
    log ? log.error(err.message || err) : console.error(err); // eslint-disable-line no-console
    throw err;
  }
};

export default runTasks;

/** @public  */
export { default as Config } from './config.js';

/** @public  */
export { default as Plugin } from './plugin/Plugin.js';
