import { Plugin } from 'release-it';
import { assertType, Equals } from './utils.js';

type UndefinedOrStringPromise = undefined | Promise<string>;

class Exec extends Plugin {
  override async bump() {
    const emptyStringCommandResult = this.exec('');
    assertType<Equals<typeof emptyStringCommandResult, undefined>>();

    const stringCommandResult = this.exec('echo "Executing command..."');
    assertType<Equals<typeof stringCommandResult, Promise<string>>>();

    const stringCommandWithOptionsResult = this.exec('echo "Executing command with options..."', {
      options: { cwd: '/tmp' }
    });
    assertType<Equals<typeof stringCommandWithOptionsResult, Promise<string>>>();

    const stringCommandWithContextResult = this.exec('echo "Executing command with context..."', {
      context: { contextProp: 'contextValue' }
    });
    assertType<Equals<typeof stringCommandWithContextResult, Promise<string>>>();

    const stringCommandWithOptionsAndContextResult = this.exec('echo "Executing command with options and context..."', {
      options: { cwd: '/tmp' },
      context: { contextProp: 'contextValue' }
    });
    assertType<Equals<typeof stringCommandWithOptionsAndContextResult, Promise<string>>>();

    const emptyArrayCommandResult = this.exec([]);
    assertType<Equals<typeof emptyArrayCommandResult, UndefinedOrStringPromise>>();

    const arrayCommandResult = this.exec(['echo', 'Executing command with array...']);
    assertType<Equals<typeof arrayCommandResult, UndefinedOrStringPromise>>();

    const arrayCommandWithOptionsAndContextResult = this.exec(
      ['echo', 'Executing command with array, options and context...'],
      {
        options: { cwd: '/tmp' },
        context: { contextProp: 'contextValue' }
      }
    );
    assertType<Equals<typeof arrayCommandWithOptionsAndContextResult, UndefinedOrStringPromise>>();
  }
}
