import { exec, SpawnOptions } from 'node:child_process';

export default interface Shell {
  exec(
    command: string,
    options: {
      write?: boolean;
      external?: boolean;
      cache?: boolean;
      interactive?: boolean;
      env?: NonNullable<Parameters<typeof exec>[1]>['env'];
    },
    context: any
  ): Promise<any>;
  exec(
    command: string[],
    options: {
      write?: boolean;
      external?: boolean;
      cache?: boolean;
      interactive?: boolean;
      env?: NonNullable<Parameters<typeof exec>[1]>['env'];
    } & SpawnOptions,
    context: any
  ): Promise<any>;
}
