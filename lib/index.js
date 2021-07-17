import { version, help } from './cli';
import runTasks from './tasks';
import Plugin from './plugin/Plugin';

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
