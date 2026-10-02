import Logger from './log';
import Spinner, { SpinnerShowOptions } from './spinner';
import Prompt, { PromptConfig, PromptShowOptions } from './prompt';
import Shell, { CommonExecOptions } from './shell';
import { DebugLogger } from 'node:util';
import { Config as Options } from './config';
import { SpawnOptions } from 'node:child_process';

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

export interface PluginConstructorArgs {
  namespace: string;
  options: Options;
  container: Container;
}

export default class Plugin<PluginOptions = any, ContextType = Record<PropertyKey, any>> {
  constructor(constructorArgs: PluginConstructorArgs);

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

  namespace: string;
  options: Readonly<PluginOptions>;
  context: ContextType;
  config: Config;
  log: Logger;
  shell: Shell;
  spinner: Spinner;
  prompt: Prompt;
  debug: DebugLogger;

  getInitialOptions(options: Options, namespace: string): PluginOptions;
  getContext(path?: string): any;
  setContext(options: Partial<typeof this.context>): void;
  exec(
    command: string | string[],
    { options, context }?: { options: CommonExecOptions & SpawnOptions; context?: object | null }
  ): Promise<any>;

  registerPrompts(prompts: Record<string, PromptConfig>): void;
  showPrompt: Prompt['show'];
  step<TaskReturnType>(
    options: SpinnerShowOptions<TaskReturnType> & PromptShowOptions<TaskReturnType>
  ): Spinner['show'] | Prompt['show'];
}
