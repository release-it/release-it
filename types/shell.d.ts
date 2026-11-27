import { ExecOptions as NodeExecOptions, SpawnOptions as NodeSpawnOptions } from 'node:child_process';

export interface CommonExecOptions {
  write?: boolean;
  external?: boolean;
  cache?: boolean;
}

export type StringCommandExecOptions = CommonExecOptions & NodeExecOptions;

export type ArrayCommandExecOptions = CommonExecOptions & NodeSpawnOptions & { interactive?: boolean };

export type NonEmptyString<T extends string> = '' extends T ? never : T;

export default class Shell {
  exec(command: '', options?: CommonExecOptions, context?: object | null): undefined;
  exec<CommandLiteralType extends string>(
    command: NonEmptyString<CommandLiteralType>,
    options: StringCommandExecOptions & { write: false },
    context?: object | null
  ): Promise<string>;
  exec<CommandLiteralType extends string>(
    command: NonEmptyString<CommandLiteralType>,
    options?: StringCommandExecOptions,
    context?: object | null
  ): Promise<string | undefined>;
  exec(command: string, options?: CommonExecOptions, context?: object | null): undefined | Promise<string | undefined>;
  exec(
    command: string[],
    options: ArrayCommandExecOptions & { write: false },
    context?: object | null
  ): undefined | Promise<string>;
  exec(
    command: string[],
    options?: ArrayCommandExecOptions,
    context?: object | null
  ): undefined | Promise<string | undefined>;
}
