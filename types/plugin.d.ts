import Logger from './log';
import Spinner from './spinner';
import Prompt, { PromptConfig } from './prompt';
import Shell from './shell';
import { DebugLogger } from 'node:util';
import { Config as Options } from './config';

export interface Config {
  getContext(path: string): any;
  setContext(options: Record<string, any>): void;
  setCI(value: boolean): void;

  isDryRun: boolean;
  isIncrement: boolean;
  isVerbose: boolean;
  verbosityLevel: number;
  isDebug: boolean;
  isQuiet: boolean;
  isCI: boolean;
  isPromptOnlyVersion: boolean;
  isReleaseVersion: boolean;
  isChangelog: boolean;

  options: Options;
  localConfig: any;
}

export interface Context {
  [key: string]: any;

  log: Logger;
  shell: Shell;
  spinner: Spinner;
  prompt: Prompt;
}

export interface Container {
  log: Logger;
  spinner: Spinner;
  prompt: Prompt;
  shell: Shell;
}

export type ReleaseType = 'major' | 'minor' | 'patch';
export type PreReleaseType = 'premajor' | 'preminor' | 'prepatch';
export type ContinuationType = 'prerelease' | 'pre';

export type Increment = ReleaseType | PreReleaseType | ContinuationType;

export interface IncrementBase {
  latestVersion: string;
  increment: Increment;
  isPreRelease: boolean;
  preReleaseId: string;
  preReleaseBase: string;
}

export default class Plugin {
  constructor({ namespace, options, container }: { namespace: string; options: Options; container: Container });

  init(): void | Promise<void>;
  getName(): undefined | string | Promise<string>;
  getLatestVersion(): undefined | string | Promise<string>;
  getChangelog(latestVersion: string): undefined | string | Promise<string>;
  getIncrement(incrementBase: IncrementBase): undefined | string | Promise<string>;
  getIncrementedVersionCI(incrementBase: IncrementBase): undefined | string | Promise<string>;
  getIncrementedVersion(incrementBase: IncrementBase): undefined | string | Promise<string>;
  beforeBump(): void | Promise<void>;
  bump(version: string): void | Promise<void>;
  beforeRelease(): void | Promise<void>;
  release(): void | Promise<void>;
  afterRelease(): void | Promise<void>;

  options: Options;
  config: Config;
  log: Logger;
  shell: Shell;
  spinner: Spinner;
  prompt: Prompt;
  debug: DebugLogger;

  getInitialOptions(options: Options, namespace: string): unknown;
  getContext(path: string): any;
  exec(command: string, { options, context }: { options: Record<string, any>; context: Context }): Promise<any>;

  registerPrompts(prompts: PromptConfig[]): void;
  showPrompt: Prompt['show'];
}
