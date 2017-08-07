import ora from 'ora';
import { config } from './config';
import { debugConfig } from './debug';

const showSpinner = !config.isInteractive && !config.isVerbose && !config.isDryRun && !debugConfig.enabled;

const noop = Promise.resolve();

const spinner = showSpinner
  ? ora()
  : {
      init: () => spinner,
      start: () => spinner,
      succeed: () => spinner,
      warn: () => spinner,
      fail: () => spinner
    };

export function getSpinner() {
  return spinner;
}

export default function run(shouldRun, task, txt) {
  if (!shouldRun) return noop;
  const p = task();
  if (showSpinner) {
    ora.promise(p, txt);
  }
  return p;
}
