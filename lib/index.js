import { version, help } from './cli';
import { config } from './config';
import runTasks from './tasks';

export default function release() {
  if (config.isShowVersion) {
    version();
  } else if (config.isShowHelp) {
    help();
  } else {
    return runTasks();
  }
  return Promise.resolve();
}
