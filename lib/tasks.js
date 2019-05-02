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
    const { isInteractive, isVerbose, isDryRun, isDebug } = config;
    const global = { isInteractive, isVerbose, isDryRun, isDebug };

    container.log = container.log || new Logger(global);
    container.spinner = container.spinner || new Spinner({ global, container, config });
    container.prompt = new Prompt({ container: { config } });
    container.metrics = new Metrics({ isEnabled: config.isCollectMetrics });
    container.shell = container.shell || new Shell({ global, container });

    const { log, metrics, shell, spinner, prompt } = container;

    const options = handleDeprecated(config.getContext(), log);

    metrics.trackEvent('start', options);

    await throwOnBreakingOptions(options);

    const plugins = await Factory.getPlugins(config, global, { config, log, shell, spinner, prompt });

    await Promise.all(plugins.map(plugin => plugin.init()));

    const { beforeStart, beforeBump, afterBump, beforeStage, afterRelease } = options.scripts;

    const name = await reduceUntil(plugins, plugin => plugin.getName());
    const latestVersion = await reduceUntil(plugins, plugin => plugin.getLatestVersion());
    let version = await reduceUntil(plugins, plugin => plugin.getIncrementedVersionSync({ latestVersion }));

    // TODO: what's the best way to get (and store) this information?
    const repo = await reduceUntil(plugins, plugin => plugin.getContext('repo'));
    const changelog = await reduceUntil(plugins, plugin => plugin.getContext('changelog'));
    config.setContext({ name, latestVersion, version, repo, changelog });

    // Helper for user scripts
    const runScript = async scripts => {
      if (!scripts || !scripts.length) return;
      const context = config.getContext();
      for (const script of _.castArray(scripts)) {
        const task = () => shell.exec(script, {}, context);
        await spinner.show({ task, label: script, context, forced: true });
      }
    };

    await runScript(beforeStart);

    const suffix = version ? `${latestVersion}...${version}` : `currently at ${latestVersion}`;

    log.obtrusive(`🚀 Let's release ${name} (${suffix})`);

    log.preview({ title: 'changelog', text: changelog });

    version = version || (await reduceUntil(plugins, plugin => plugin.getIncrementedVersion({ latestVersion })));
    config.setContext(parseVersion(version));

    for (const plugin of plugins) {
      await plugin.beforeBump();
    }

    await runScript(beforeBump);
    await Promise.all(plugins.map(plugin => plugin.bump(version)));
    await runScript(afterBump);
    await runScript(beforeStage);

    for (const plugin of plugins) {
      await plugin.beforeRelease();
    }

    plugins.reverse();

    for (const plugin of plugins) {
      await plugin.release();
    }

    await runScript(afterRelease);

    for (const plugin of plugins) {
      await plugin.afterRelease();
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
    metrics && (await metrics.trackException(err));
    log ? log.error(err.message || err) : console.error(err); // eslint-disable-line no-console
    throw err;
  }
};

module.exports = runTasks;
