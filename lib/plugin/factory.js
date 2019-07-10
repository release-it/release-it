const path = require('path');
const _ = require('lodash');
const requireCwd = require('import-cwd');
const debug = require('debug')('release-it:plugins');
const Version = require('./version/Version');
const Git = require('./git/Git');
const GitLab = require('./gitlab/GitLab');
const GitHub = require('./github/GitHub');
const npm = require('./npm/npm');

const pluginNames = ['version', 'git', 'github', 'gitlab', 'npm'];

const plugins = {
  version: Version,
  git: Git,
  gitlab: GitLab,
  github: GitHub,
  npm: npm
};

const load = pluginName => {
  let plugin = null;
  try {
    plugin = require(pluginName);
  } catch (err) {
    plugin = requireCwd(pluginName);
  }
  return [path.parse(pluginName).name, plugin];
};

module.exports.getPlugins = async (config, global, container) => {
  const context = config.getContext();
  const disabledPlugins = [];

  const enabledExternalPlugins = await _.reduce(
    context.plugins,
    async (result, pluginConfig, pluginName) => {
      const [name, Plugin] = load(pluginName);
      const [namespace, options] = pluginConfig.length === 2 ? pluginConfig : [name, pluginConfig];
      config.setContext({ [namespace]: options });
      if (await Plugin.isEnabled(options)) {
        const instance = new Plugin({ namespace, options: config.getContext(), global, container });
        debug({ namespace, options: instance.options });
        (await result).push(instance);
        disabledPlugins.push(..._.intersection(pluginNames, _.castArray(Plugin.disablePlugin())));
      }
      return result;
    },
    []
  );

  const enabledPlugins = await pluginNames.reduce(async (result, plugin) => {
    if (plugin in plugins && !disabledPlugins.includes(plugin)) {
      const Plugin = plugins[plugin];
      const pluginOptions = context[plugin];
      if (await Plugin.isEnabled(pluginOptions)) {
        const instance = new Plugin({ namespace: plugin, options: context, global, container });
        debug({ namespace: plugin, options: instance.options });
        (await result).push(instance);
      }
    }
    return result;
  }, []);

  return enabledExternalPlugins.concat(enabledPlugins.reverse());
};
