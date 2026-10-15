import type { Config } from './config.js';

export type { Config } from './config.js';

export interface ReleaseResult {
  name?: string;
  changelog?: string;
  latestVersion: string;
  version?: string;
}

/**
 * Programmatic API entry point (lib/index.js `runTasks`).
 * Accepts the same options as the CLI, plus hooks and plugin configuration.
 */
export default function release(
  options: Config,
  dependencies?: Record<string, unknown>
): Promise<ReleaseResult>;
