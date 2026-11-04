import { Plugin } from '../';

class Exec extends Plugin {
  override async bump() {
    let expectUndefined: undefined;
    let expectStringPromise: Promise<string>;

    expectUndefined = this.exec('');
    expectStringPromise = this.exec('echo "Executing command..."');
    expectStringPromise = this.exec('echo "Executing command with options..."', { options: { cwd: '/tmp' } });
    expectStringPromise = this.exec('echo "Executing command with context..."', {
      context: { contextProp: 'contextValue' }
    });
    expectStringPromise = this.exec('echo "Executing command with options and context..."', {
      options: { cwd: '/tmp' },
      context: { contextProp: 'contextValue' }
    });

    let undefinedOrStringPromise: undefined | Promise<string>;

    undefinedOrStringPromise = this.exec([]);
    undefinedOrStringPromise = this.exec(['echo', 'Executing command with array...']);
    undefinedOrStringPromise = this.exec(['echo', 'Executing command with array, options and context...'], {
      options: { cwd: '/tmp' },
      context: { contextProp: 'contextValue' }
    });
  }
}
