import util from 'node:util';
import { spawn, exec } from 'node:child_process';
import { format } from './util.js';

const debug = util.debug('release-it:shell');

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
      const proc = exec(command, (err, stdout, stderr) => {
        stdout = stdout.toString().trimEnd();
        const code = !err ? 0 : err === 'undefined' ? 1 : err.code;
        debug({ command, options, code, stdout, stderr });
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(stderr || stdout));
        }
      });
      proc.stdout.on('data', stdout => this.log.verbose(stdout.toString().trimEnd(), { isExternal }));
      proc.stderr.on('data', stderr => this.log.verbose(stderr.toString().trimEnd(), { isExternal }));
    });
  }

  async execWithArguments(command, options = {}, { isExternal } = {}) {
    const [program, ...programArgs] = command;

    try {
      return await new Promise((resolve, reject) => {
        const proc = spawn(program, programArgs, {
          // we want to capture all output from the process so the extra 2 pipe
          stdio: ['inherit', 'pipe', 'pipe'],
          ...options
        });

        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', data => {
          stdout += data.toString();
        });

        proc.stderr.on('data', data => {
          stderr += data.toString();
        });

        proc.on('close', code => {
          stdout = stdout === '""' ? '' : stdout;
          this.log.verbose(stdout, { isExternal });
          debug({ command, options, stdout, stderr });

          if (code === 0) {
            resolve((stdout || stderr).trim());
          } else {
            if (stdout) {
              this.log.log(`\n${stdout}`);
            }
            debug({ code, command, options, stdout, stderr });
            reject(new Error(stderr || stdout || `Process exited with code ${code}`));
          }
        });

        proc.on('error', err => {
          debug(err);
          reject(new Error(err.message));
        });
      });
    } catch (err) {
      debug(err);
      return Promise.reject(err);
    }
  }
}

export default Shell;
