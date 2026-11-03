import { DebugLogger } from 'node:util';
import { SpawnOptions } from 'node:child_process';
import Logger from './log.js';
import Spinner, { DisabledSpinnerShowOptions, EnabledSpinnerShowOptions, SpinnerShowOptions } from './spinner.js';
import Prompt, { DisabledPromptShowOptions, EnabledPromptShowOptions, PromptConfig, PromptShowOptions } from './prompt.js';
import Shell, { CommonExecOptions } from './shell.js';
import { Config as Options } from './config.js';

export type GenericContextType = Record<PropertyKey, any>;

export interface Config {
  getContext(): Options & GenericContextType;
  getContext(path: string): any;
  setContext(options: Record<PropertyKey, any>): void;
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

export type EnabledStepOptions<AnswerType, TaskReturnType> = EnabledPromptShowOptions<AnswerType, TaskReturnType> & EnabledSpinnerShowOptions<TaskReturnType>
export type DisabledStepOptions<AnswerType, TaskReturnType> = DisabledPromptShowOptions<AnswerType, TaskReturnType> & DisabledSpinnerShowOptions<TaskReturnType>
export type StepOptions<AnswerType, TaskReturnType> = PromptShowOptions<AnswerType, TaskReturnType> & SpinnerShowOptions<TaskReturnType>

export default class Plugin<PluginOptions = any, ContextType = GenericContextType> {
  constructor(constructorArgs: PluginConstructorArgs);

  static isEnabled(): boolean | Promise<boolean>;
  static disablePlugin(): null | string | string[];

  getName(): undefined | string | Promise<undefined | string>;
  getLatestVersion(): undefined | string | Promise<undefined | string>;
  getChangelog(latestVersion: string): undefined | string | Promise<undefined | string>;
  getIncrement(incrementBase: IncrementBase): undefined | string | Promise<undefined | string>;
  getIncrementedVersionCI(incrementBase: IncrementBase): undefined | string | Promise<undefined | string>;
  getIncrementedVersion(incrementBase: IncrementBase): undefined | string | Promise<undefined | string>;

  init(): void | boolean | Promise<void | boolean>;
  beforeBump(): void | boolean | Promise<void | boolean>;
  bump(version: string): void | boolean | Promise<void | boolean>;
  beforeRelease(): void | boolean | Promise<void | boolean>;
  release(): void | boolean | Promise<void | boolean>;
  afterRelease(): void | boolean | Promise<void | boolean>;

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
  getContext(): PluginOptions & ContextType;
  getContext(path: string): any;
  setContext(options: Partial<typeof this.context>): void;
  exec(
    command: string | string[],
    { options, context }?: { options: CommonExecOptions & SpawnOptions; context?: object | null }
  ): Promise<any>;

  registerPrompts(prompts: Record<string, PromptConfig>): void;
  showPrompt: Prompt['show'];
  step<TaskReturnType, AnswerType>(
    options: EnabledStepOptions<AnswerType, TaskReturnType>
  ): TaskReturnType | Promise<Awaited<TaskReturnType>>;
  step<TaskReturnType, AnswerType>(
    options: DisabledStepOptions<AnswerType, TaskReturnType>
  ): Promise<false | undefined>;
  step<TaskReturnType, AsyncTaskReturnType extends Promise<TaskReturnType>, AnswerType>(
    options: StepOptions<AnswerType, AsyncTaskReturnType>
  ): Promise<false | undefined | TaskReturnType>;
  step<TaskReturnType, AnswerType>(
    options: StepOptions<AnswerType, TaskReturnType>
  ): TaskReturnType | Promise<false | undefined | Awaited<TaskReturnType>>;
}
