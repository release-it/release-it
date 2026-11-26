import { Plugin } from 'release-it';
import { assertType, Equals } from './utils.js';

type StringOrUndefinedPromise = Promise<string | undefined>;
type UndefinedOrStringOrUndefinedPromise = undefined | Promise<string | undefined>;

class Exec extends Plugin {
  override async bump() {
    const emptyStringCommandResult = this.exec('');
    assertType<Equals<typeof emptyStringCommandResult, undefined>>();

    const stringCommandResult = this.exec('echo "Executing command..."');
    assertType<Equals<typeof stringCommandResult, StringOrUndefinedPromise>>();

    const readonlyCommandResult = this.exec('echo "Executing command..."', { options: { write: false } });
    assertType<Equals<typeof readonlyCommandResult, Promise<string>>>();

    const stringCommandWithOptionsResult = this.exec('echo "Executing command with options..."', {
      options: { cwd: '/tmp' }
    });
    assertType<Equals<typeof stringCommandWithOptionsResult, StringOrUndefinedPromise>>();

    const stringCommandWithContextResult = this.exec('echo "Executing command with context..."', {
      context: { contextProp: 'contextValue' }
    });
    assertType<Equals<typeof stringCommandWithContextResult, StringOrUndefinedPromise>>();

    const stringCommandWithOptionsAndContextResult = this.exec('echo "Executing command with options and context..."', {
      options: { cwd: '/tmp' },
      context: { contextProp: 'contextValue' }
    });
    assertType<Equals<typeof stringCommandWithOptionsAndContextResult, StringOrUndefinedPromise>>();

    const emptyArrayCommandResult = this.exec([]);
    assertType<Equals<typeof emptyArrayCommandResult, UndefinedOrStringOrUndefinedPromise>>();

    const arrayCommandResult = this.exec(['echo', 'Executing command with array...']);
    assertType<Equals<typeof arrayCommandResult, UndefinedOrStringOrUndefinedPromise>>();

    const arrayCommandWithOptionsAndContextResult = this.exec(
      ['echo', 'Executing command with array, options and context...'],
      {
        options: { cwd: '/tmp' },
        context: { contextProp: 'contextValue' }
      }
    );
    assertType<Equals<typeof arrayCommandWithOptionsAndContextResult, UndefinedOrStringOrUndefinedPromise>>();
  }
}

class ShellExec extends Plugin {
  override async bump() {
    const emptyStringCommandResult = this.shell.exec('');
    assertType<Equals<typeof emptyStringCommandResult, undefined>>();

    const stringCommandResult = this.shell.exec('echo "Executing command..."');
    assertType<Equals<typeof stringCommandResult, StringOrUndefinedPromise>>();

    const readonlyCommandResult = this.shell.exec('echo "Executing command..."', { write: false });
    assertType<Equals<typeof readonlyCommandResult, Promise<string>>>();

    const stringCommandWithOptionsResult = this.shell.exec('echo "Executing command with options..."', {
      cwd: '/tmp'
    });
    assertType<Equals<typeof stringCommandWithOptionsResult, StringOrUndefinedPromise>>();

    const stringCommandWithContextResult = this.shell.exec(
      'echo "Executing command with context..."',
      {},
      { contextProp: 'contextValue' }
    );
    assertType<Equals<typeof stringCommandWithContextResult, StringOrUndefinedPromise>>();

    const stringCommandWithOptionsAndContextResult = this.shell.exec(
      'echo "Executing command with options and context..."',
      { cwd: '/tmp' },
      { contextProp: 'contextValue' }
    );
    assertType<Equals<typeof stringCommandWithOptionsAndContextResult, StringOrUndefinedPromise>>();

    const emptyArrayCommandResult = this.shell.exec([]);
    assertType<Equals<typeof emptyArrayCommandResult, UndefinedOrStringOrUndefinedPromise>>();

    const arrayCommandResult = this.shell.exec(['echo', 'Executing command with array...']);
    assertType<Equals<typeof arrayCommandResult, UndefinedOrStringOrUndefinedPromise>>();

    const arrayCommandWithOptionsAndContextResult = this.shell.exec(
      ['echo', 'Executing command with array, options and context...'],
      { cwd: '/tmp' },
      { contextProp: 'contextValue' }
    );
    assertType<Equals<typeof arrayCommandWithOptionsAndContextResult, UndefinedOrStringOrUndefinedPromise>>();
  }
}
