import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sh from 'shelljs';

const mkTmpDir = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'release-it-'));
  return dir;
};

const readFile = file => fs.promises.readFile(path.resolve(file), 'utf8');

const gitAdd = (content, filePath, message) => {
  const pathSegments = filePath.split('/').filter(Boolean);
  pathSegments.pop();
  if (pathSegments.length) {
    sh.mkdir('-p', pathSegments.join('/'));
  }
  sh.ShellString(content).toEnd(filePath);
  sh.exec(`git add ${filePath}`);
  const { stdout } = sh.exec(`git commit -m "${message}"`);
  const match = stdout.match(/\[.+([a-z0-9]{7})\]/);
  return match ? match[1] : null;
};

const getArgs = (args, prefix) =>
  args
    .map(args => (typeof args[0] !== 'string' ? args[0].join(' ') : args[0]))
    .filter(cmd => cmd.startsWith(prefix))
    .map(cmd => cmd.trim());

export { mkTmpDir, readFile, gitAdd, getArgs };
