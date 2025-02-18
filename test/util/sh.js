import { spawnSync } from 'node:child_process';

const getCommandAndArgs = input => {
  if (typeof input !== 'string' || !input.trim()) {
    throw new Error('Invalid input: expected a non-empty string.');
  }

  const [command, ...args] = input.trim().split(/\s+/);

  return [command, args];
};

const exec = (command, opts = { stdio: 'inherit' }) => {
  const [cmd, args] = getCommandAndArgs(command);
  return spawnSync(cmd, args, opts);
};

export default { getCommandAndArgs, exec };
