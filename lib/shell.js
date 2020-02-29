const execa = require('execa');
const debug = require('debug')('release-it:shell');
const { format, clean } = require('./util');

const noop = Promise.resolve();

class Shell {
  constructor({ global = {}, container }) {
    this.global = global;
    this.log = container.log;
    this.config = container.config;
  }

  async execFormattedCommand(command, options = {}) {
    const [program, ...programArgs] = typeof command === 'string' ? [] : clean(command);
    const isDryRun = this.global.isDryRun;
    const isWrite = options.write !== false;
    const isExternal = options.external === true;

    if (isDryRun && isWrite) {
      this.log.exec(command, { isDryRun });
      return noop;
    }

    this.log.exec(command, { isExternal });

    try {
      const { stdout: out, stderr } =
        typeof command === 'string' ? await execa.command(command) : await execa(program, programArgs);

      const stdout = out === '""' ? '' : out;

      this.log.verbose(stdout, { isExternal });

      debug({ command, stdout, stderr });

      return Promise.resolve(stdout || stderr);
    } catch (error) {
      debug({ error });
      return Promise.reject(new Error(error.stderr || error.message));
    }
  }

  exec(command, options = {}, context = {}) {
    if (!command) return;
    return typeof command === 'string'
      ? this.execFormattedCommand(format(command, context), options)
      : this.execFormattedCommand(command, options);
  }
}

module.exports = Shell;
