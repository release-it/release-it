import { version, help } from './cli';
import { config } from './config';
import runTasks from './tasks';
import track, { trackException } from './metrics';

export default function release() {
  if (config.isShowVersion) {
    version();
  } else if (config.isShowHelp) {
    help();
  } else {
    track('start');
    return runTasks().then(() => track('end'), trackException);
  }
  return Promise.resolve();
}
