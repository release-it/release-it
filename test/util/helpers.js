const fs = require('fs').promises;
const path = require('path');
const sh = require('shelljs');
const tmp = require('tmp');

const mkTmpDir = () => {
  const dir = tmp.dirSync({ prefix: 'release-it-' });
  return dir.name;
};

const readFile = file => fs.readFile(path.resolve(file), 'utf8');

const gitAdd = (content, file, message) => {
  sh.ShellString(content).toEnd(file);
  sh.exec(`git add ${file}`);
  const { stdout } = sh.exec(`git commit -m "${message}"`);
  const match = stdout.match(/\[.+([a-z0-9]{7})\]/);
  return match ? match[1] : null;
};

const getArgs = (args, prefix) =>
  args.filter(args => typeof args[0] === 'string' && args[0].startsWith(prefix)).map(args => args[0].trim());

module.exports = {
  mkTmpDir,
  readFile,
  gitAdd,
  getArgs
};
