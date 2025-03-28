import { appendFileSync, mkdirSync, mkdtempSync, promises } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import childProcess from 'node:child_process';
import { execOpts } from '../../lib/util.js';

const mkTmpDir = () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'release-it-'));
  return dir;
};

const readFile = file => promises.readFile(path.resolve(file), 'utf8');

const gitAdd = (content, filePath, message) => {
  appendFile(content, filePath);
  childProcess.execSync(`git add ${filePath}`, execOpts);
  const stdout = childProcess.execSync(`git commit -m "${message}"`, { encoding: 'utf-8' });
  const match = stdout.match(/\[.+([a-z0-9]{7})\]/);
  return match ? match[1] : null;
};

const getArgs = (args, prefix) =>
  args
    .map(args => (typeof args[0] !== 'string' ? args[0].join(' ') : args[0]))
    .filter(cmd => cmd.startsWith(prefix))
    .map(cmd => cmd.trim());

const appendFile = (content, filePath, cwd) => {
  filePath = path.join(cwd ?? '', filePath);

  const pathSegments = filePath.split('/').filter(Boolean);
  pathSegments.pop();
  if (pathSegments.length) {
    mkdirSync(path.resolve(pathSegments.join('/')), { mode: parseInt('0777', 8), recursive: true });
  }

  appendFileSync(filePath, content);
};

export { mkTmpDir, readFile, gitAdd, getArgs, appendFile };
