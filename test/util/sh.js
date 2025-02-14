import childProcess from 'node:child_process';

const getCommandAndArgs = input => {
  //"git checkout master".split(' ').slice(1)
  if (!input || (input && typeof input !== 'string'))
    throw new Error(`No command given to getCommandAndArgs. Please check input and/or type`);

  const command = input.split(' ').reverse().pop();

  if (!command || command === '')
    throw new Error(`Invalid input given to getCommandArgs. Please check input and/or type`);

  const args = input.split(' ').slice(1);

  if (!args || args.length === 0) return [command];

  return [command, args];
};

const exec = command => {
  return childProcess.spawnSync(...getCommandAndArgs(command));
};

const _export = { getCommandAndArgs, exec };

export default _export;
