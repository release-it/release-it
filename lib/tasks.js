const _ = require('lodash');
const Factory = require('./plugin/factory');
const Logger = require('./log');
const Config = require('./config');
const Shell = require('./shell');
const Prompt = require('./prompt');
const Spinner = require('./spinner');
const Metrics = require('./metrics');
const { reduceUntil, parseVersion } = require('./util');
const handleDeprecated = require('./deprecated');
const throwOnBreakingOptions = require('./breaking');

const runTasks = async (opts, di) => {
  let container = {};

  try {
    Object.assign(container, di);
    container.config = container.config || new Config(opts);

    const { config } = container;
    const { isCI, isVerbose, verbosityLevel, isDryRun, isDebug } = config;
    const global = { isCI, isVerbose, verbosityLevel, isDryRun, isDebug };

    container.log = container.log || new Logger(global);
    container.spinner = container.spinner || new Spinner({ global, container, config });
    container.prompt = new Prompt({ container: { config } });
    container.metrics = new Metrics({ isEnabled: config.isCollectMetrics });
    container.shell = container.shell || new Shell({ global, container });

    const { log, metrics, shell, spinner, prompt } = container;

    const options = handleDeprecated(config.getContext(), log);

    metrics.trackEvent('start', options);

    await throwOnBreakingOptions(options);

    const { hooks } = options;

    // Helper for user scripts
    const runScript = async scripts => {
      if (!scripts || !scripts.length) return;
      const context = config.getContext();
      const external = true;
      for (const script of _.castArray(scripts)) {
        const task = () => shell.exec(script, { external }, context);
        await spinner.show({ task, label: script, context, external });
      }
    };

    const runHook = (prefix, namespace, hook) => runScript(hooks[`${prefix}:${namespace}:${hook}`]);

    const runLifeCycleHook = async (plugin, name, ...args) => {
      if (plugin === _.first(plugins)) await runScript(hooks[`before:${name}`]);
      await runHook('before', plugin.namespace, name);
      await plugin[name](...args);
      await runHook('after', plugin.namespace, name);
      if (plugin === _.last(plugins)) await runScript(hooks[`after:${name}`]);
    };

    const plugins = await Factory.getPlugins(config, global, { config, log, shell, spinner, prompt });

    for (const plugin of plugins) {
      await runLifeCycleHook(plugin, 'init');
    }

    const { increment, isPreRelease, preReleaseId } = options.version;

    const name = await reduceUntil(plugins, plugin => plugin.getName());
    const latestVersion = await reduceUntil(plugins, plugin => plugin.getLatestVersion());

    // TODO: what's the best way to get (and store) this information?
    const repo = await reduceUntil(plugins, plugin => plugin.getContext('repo'));
    const changelog = await reduceUntil(plugins, plugin => plugin.getContext('changelog'));

    const incrementBase = { latestVersion, increment, isPreRelease, preReleaseId };
    let version = await reduceUntil(plugins, plugin => plugin.getIncrementedVersionCI(incrementBase));

    config.setContext({ name, latestVersion, version, repo, changelog });

    const suffix = version ? `${latestVersion}...${version}` : `currently at ${latestVersion}`;

    log.obtrusive(`🚀 Let's release ${name} (${suffix})`);

    log.preview({ title: 'changelog', text: changelog });

    version = version || (await reduceUntil(plugins, plugin => plugin.getIncrementedVersion(incrementBase)));
    config.setContext(parseVersion(version));

    for (const hook of ['beforeBump', 'bump', 'beforeRelease']) {
      for (const plugin of plugins) {
        const args = hook === 'bump' ? [version] : [];
        await runLifeCycleHook(plugin, hook, ...args);
      }
    }

    plugins.reverse();

    for (const hook of ['release', 'afterRelease']) {
      for (const plugin of plugins) {
        await runLifeCycleHook(plugin, hook);
      }
    }

    await metrics.trackEvent('end');

    log.log(`🏁 Done (in ${Math.floor(process.uptime())}s.)`);

    return {
      name,
      changelog,
      latestVersion,
      version
    };
  } catch (err) {
    const { log, metrics } = container;
    if (metrics) {
      await metrics.trackException(err);
    }
    log ? log.error(err.message || err) : console.error(err); // eslint-disable-line no-console
    throw err;
  }
};

module.exports = runTasks;
