import url from 'node:url';
import path from 'node:path';
import util from 'node:util';
import { createRequire } from 'node:module';
import { castArray } from '../util.js';
import Version from './version/Version.js';
import Git from './git/Git.js';
import GitLab from './gitlab/GitLab.js';
import GitHub from './github/GitHub.js';
import npm from './npm/npm.js';

const debug = util.debug('release-it:plugins');

const pluginNames = ['npm', 'git', 'github', 'gitlab', 'version'];

const plugins = {
  version: Version,
  git: Git,
  gitlab: GitLab,
  github: GitHub,
  npm: npm
};

const load = async pluginName => {
  let plugin = null;
  try {
    const module = await import(pluginName);
    plugin = module.default;
  } catch (err) {
    debug(err);
    try {
      const module = await import(path.join(process.cwd(), pluginName));
      plugin = module.default;
    } catch (err) {
      debug(err);
      // In some cases or tests we might need to support legacy `require.resolve`
      const require = createRequire(process.cwd());
      const module = await import(url.pathToFileURL(require.resolve(pluginName, { paths: [process.cwd()] })));
      plugin = module.default;
    }
  }
  return [getPluginName(pluginName), plugin];
};

/** @internal */
export const getPluginName = pluginName => {
  if (pluginName.startsWith('.')) {
    return path.parse(pluginName).name;
  }

  return pluginName;
};

export let getPlugins = async (config, container) => {
  const context = config.getContext();
  const disabledPlugins = [];
  const enabledExternalPlugins = [];
  if (context.plugins) {
    for (const [pluginName, pluginConfig] of Object.entries(context.plugins)) {
      const [name, Plugin] = await load(pluginName);
      const [namespace, options] = pluginConfig.length === 2 ? pluginConfig : [name, pluginConfig];

      config.setContext({ [namespace]: options });

      if (await Plugin.isEnabled(options)) {
        const instance = new Plugin({ namespace, options: config.getContext(), container });
        debug({ namespace, options: instance.options });
        enabledExternalPlugins.push(instance);

        disabledPlugins.push(...pluginNames.filter(p => castArray(Plugin.disablePlugin(options)).includes(p)));
      }
    }
  }

  const enabledPlugins = await pluginNames.reduce(async (result, plugin) => {
    if (plugin in plugins && !disabledPlugins.includes(plugin)) {
      const Plugin = plugins[plugin];
      const pluginOptions = context[plugin];
      if (await Plugin.isEnabled(pluginOptions)) {
        const instance = new Plugin({ namespace: plugin, options: context, container });
        debug({ namespace: plugin, options: instance.options });
        (await result).push(instance);
      }
    }
    return result;
  }, []);

  return [enabledPlugins, enabledExternalPlugins];
};
