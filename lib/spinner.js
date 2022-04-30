import { oraPromise } from 'ora';
import { format } from './util.js';

const noop = Promise.resolve();

class Spinner {
  constructor({ container = {} } = {}) {
    this.config = container.config;
    this.ora = container.ora || oraPromise;
  }
  show({ enabled = true, task, label, external = false, context }) {
    if (!enabled) return noop;

    const { config } = this;
    this.isSpinnerDisabled = !config.isCI || config.isVerbose || config.isDryRun || config.isDebug;
    this.canForce = !config.isCI && !config.isVerbose && !config.isDryRun && !config.isDebug;

    const awaitTask = task();

    if (!this.isSpinnerDisabled || (external && this.canForce)) {
      const text = format(label, context);
      this.ora(awaitTask, text);
    }

    return awaitTask;
  }
}

export default Spinner;
