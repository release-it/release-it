import util from 'node:util';
import sh from 'shelljs';
import { execa } from 'execa';
import { format } from './util.js';

const debug = util.debug('release-it:shell');

sh.config.silent = !debug.enabled;

const noop = Promise.resolve();

class Shell {
  constructor({ container }) {
    this.log = container.log;
    this.config = container.config;
    this.cache = new Map();
  }

  exec(command, options = {}, context = {}) {
    if (!command || !command.length) return;
    return typeof command === 'string'
      ? this.execFormattedCommand(format(command, context), options)
      : this.execFormattedCommand(command, options);
  }

  async execFormattedCommand(command, options = {}) {
    const { isDryRun } = this.config;
    const isWrite = options.write !== false;
    const isExternal = options.external === true;
    const cacheKey = typeof command === 'string' ? command : command.join(' ');
    const isCached = !isExternal && this.cache.has(cacheKey);

    if (isDryRun && isWrite) {
      this.log.exec(command, { isDryRun });
      return noop;
    }

    this.log.exec(command, { isExternal, isCached });

    if (isCached) {
      return this.cache.get(cacheKey);
    }

    const result =
      typeof command === 'string'
        ? this.execStringCommand(command, options, { isExternal })
        : this.execWithArguments(command, options, { isExternal });

    if (!isExternal && !this.cache.has(cacheKey)) {
      this.cache.set(cacheKey, result);
    }

    return result;
  }

  execStringCommand(command, options, { isExternal }) {
    return new Promise((resolve, reject) => {
      const childProcess = sh.exec(command, { async: true }, (code, stdout, stderr) => {
        stdout = stdout.toString().trimEnd();
        debug({ command, options, code, stdout, stderr });
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(stderr || stdout));
        }
      });
      childProcess.stdout.on('data', stdout => this.log.verbose(stdout.toString().trimEnd(), { isExternal }));
      childProcess.stderr.on('data', stderr => this.log.verbose(stderr.toString().trimEnd(), { isExternal }));
    });
  }

  async execWithArguments(command, options, { isExternal }) {
    const [program, ...programArgs] = command;

    try {
      const { stdout: out, stderr } = await execa(program, programArgs);
      const stdout = out === '""' ? '' : out;
      this.log.verbose(stdout, { isExternal });
      debug({ command, options, stdout, stderr });
      return Promise.resolve(stdout || stderr);
    } catch (error) {
      if (error.stdout) {
        this.log.log(`\n${error.stdout}`);
      }
      debug({ error });
      return Promise.reject(new Error(error.stderr || error.message));
    }
  }
}

export default Shell;
