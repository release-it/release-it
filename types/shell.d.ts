import { exec, SpawnOptions } from 'node:child_process';

export interface CommonExecOptions {
  write?: boolean;
  external?: boolean;
  cache?: boolean;
  interactive?: boolean;
  env?: NonNullable<Parameters<typeof exec>[1]>['env'];
}

export default interface Shell {
  exec(
    command: string,
    options: CommonExecOptions,
    context?: object | null
  ): Promise<any>;
  exec(
    command: string[],
    options: CommonExecOptions & SpawnOptions,
    context?: object | null
  ): Promise<any>;
}
