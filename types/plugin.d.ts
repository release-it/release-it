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

export default class Plugin {
  constructor({ namespace, options, container }: { namespace: string; options: Options; container: Container });

  init(): void;
  getName(): string;
  getLatestVersion(): string;
  getChangelog(): string;
  getIncrement(): string;
  getIncrementedVersionCI(): string;
  getIncrementedVersion(): string;
  beforeBump(): void;
  bump(): void;
  beforeRelease(): void;
  release(): void;
  afterRelease(): void;

  options: Options;
  config: Config;
  log: Logger;
  shell: Shell;
  spinner: Spinner;
  prompt: Prompt;
  debug: DebugLogger;

  getContext(path: string): any;
  exec(command: string, { options, context }: { options: Record<string, any>; context: Context }): Promise<any>;

  registerPrompts(prompts: PromptConfig[]): void;
  showPrompt: Prompt['show'];
}
