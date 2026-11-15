import type { Config } from './config.js';

export type { Config } from './config.js';

export interface ReleaseResult {
  name?: string;
  changelog?: string;
  latestVersion: string;
  version?: string | null;
}

/** Runs a release and resolves with the name, changelog, latest version and new version (`null` if there is none) */
export default function release(options: Config, dependencies?: Record<string, unknown>): Promise<ReleaseResult>;
