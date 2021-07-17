import { version, help } from './cli.js';
import runTasks from './tasks.js';
import Plugin from './plugin/Plugin.js';

export default async options => {
  if (options.version) {
    version();
  } else if (options.help) {
    help();
  } else {
    return runTasks(options);
  }
  return Promise.resolve();
};

export { Plugin };
