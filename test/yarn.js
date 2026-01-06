import { join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import npm from '../lib/plugin/npm/npm.js';
import { factory, runTasks } from './util/index.js';
import { mkTmpDir, getArgs } from './util/helpers.js';

test('routes npm checks via yarn when packageManager=yarn', async t => {
  const tmp = mkTmpDir();
  process.chdir(tmp);
  writeFileSync(
    join(tmp, 'package.json'),
    JSON.stringify({ name: 'release-it', version: '1.0.0', packageManager: 'yarn@4.11.0' })
  );

  const npmClient = await factory(npm);

  const exec = t.mock.method(npmClient.shell, 'exec', command => {
    if (Array.isArray(command) && command[0] === 'yarn' && command[1] === 'npm') {
      const sub = command.slice(2);
      if (sub[0] === 'whoami') return Promise.resolve('john');
      if (sub[0] === '--version') return Promise.resolve('9.2.0');
      if (sub[0] === 'access' && sub[1] === 'list' && sub[2] === 'collaborators') {
        return Promise.resolve(JSON.stringify({ john: ['write'] }));
      }
      return Promise.resolve('');
    }
    return Promise.resolve('');
  });

  await runTasks(npmClient);

  const yarnArgs = getArgs(exec, 'yarn npm');
  assert.match(yarnArgs[0], /^yarn npm ping/);
  assert.match(yarnArgs[1], /^yarn npm whoami/);
  assert.match(yarnArgs[2], /^yarn npm show release-it@[a-z]+ version/);
  assert.match(yarnArgs[3], /^yarn npm --version/);
  assert(yarnArgs.some(a => /yarn npm access (list collaborators --json|ls-collaborators) release-it/.test(a)));
});

test('routes npm checks via yarn when devEngines.packageManager.name=yarn', async t => {
  const tmp = mkTmpDir();
  process.chdir(tmp);
  writeFileSync(
    join(tmp, 'package.json'),
    JSON.stringify({ name: 'release-it', version: '1.0.0', devEngines: { packageManager: { name: 'yarn' } } })
  );

  const npmClient = await factory(npm);

  const exec = t.mock.method(npmClient.shell, 'exec', command => {
    if (Array.isArray(command) && command[0] === 'yarn' && command[1] === 'npm') {
      const sub = command.slice(2);
      if (sub[0] === 'whoami') return Promise.resolve('john');
      if (sub[0] === '--version') return Promise.resolve('9.2.0');
      if (sub[0] === 'access' && sub[1] === 'list' && sub[2] === 'collaborators') {
        return Promise.resolve(JSON.stringify({ john: ['write'] }));
      }
      return Promise.resolve('');
    }
    return Promise.resolve('');
  });

  await runTasks(npmClient);

  const yarnArgs = getArgs(exec, 'yarn npm');
  assert.match(yarnArgs[0], /^yarn npm ping/);
  assert.match(yarnArgs[1], /^yarn npm whoami/);
  assert.match(yarnArgs[2], /^yarn npm show release-it@[a-z]+ version/);
});
