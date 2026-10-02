import { exec, SpawnOptions } from 'node:child_process';

export interface CommonExecOptions {
  write?: boolean;
  external?: boolean;
  cache?: boolean;
  interactive?: boolean;
  env?: NonNullable<Parameters<typeof exec>[1]>['env'];
}

export default class Shell {
  exec(
    command: string,
    options?: CommonExecOptions,
    context?: object | null
  ): Promise<string>;
  exec(
    command: string[],
    options?: CommonExecOptions & SpawnOptions,
    context?: object | null
  ): Promise<string>;
}
