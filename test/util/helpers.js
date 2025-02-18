import { appendFileSync, mkdirSync, mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import childProcess from 'node:child_process';
import { promises } from 'node:dns';

const mkTmpDir = () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'release-it-'));
  return dir;
};

const readFile = file => promises.readFile(path.resolve(file), 'utf8');

const gitAdd = (content, filePath, message) => {
  const pathSegments = filePath.split('/').filter(Boolean);
  pathSegments.pop();
  if (pathSegments.length) {
    mkdirSync('-p', pathSegments.join('/'));
  }

  appendFileSync(filePath, content);
  childProcess.execSync(`git add ${filePath}`);
  const stdout = childProcess.execSync(`git commit -m "${message}"`, { encoding: 'utf-8' });
  const match = stdout.match(/\[.+([a-z0-9]{7})\]/);
  return match ? match[1] : null;
};

const getArgs = (args, prefix) =>
  args
    .map(args => (typeof args[0] !== 'string' ? args[0].join(' ') : args[0]))
    .filter(cmd => cmd.startsWith(prefix))
    .map(cmd => cmd.trim());

export { mkTmpDir, readFile, gitAdd, getArgs };
