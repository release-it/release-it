const tasks = require('../lib/tasks');
const test = require('tape');
const shell = require('shelljs');
const { run, copy } = require('../lib/shell');

const tmp = 'test/resources/tmp';

test('test not a git repository', async t => {
  shell.pushd('-q', '..');

  await tasks({}).catch(e => {
    t.equal(e.code, 'NOT_GIT_REPO');
  });

  shell.popd('-q');
  t.end();
});

test('test no-remote-git-url error message', async t => {
  shell.rm('-rf', tmp);
  shell.mkdir(tmp);
  shell.pushd('-q', tmp);
  await run('git init');
  await run('touch file1');
  await run('git add file1');
  await run('git commit -am "Add file1"');

  await tasks({}).catch(e => {
    t.equal(e.code, 'NO_REMOTE_URL');
  });

  shell.popd('-q');
  shell.rm('-rf', tmp);
  t.end();
});

test('test working-dir-must-be-clean error message', async t => {
  shell.rm('-rf', tmp);
  shell.mkdir(tmp);
  shell.pushd('-q', tmp);
  await run('git init');
  await run('touch file1');
  await run('git remote add origin foo');
  await run('git add file1');

  await tasks({}).catch(e => {
    t.equal(e.code, 'WORKING_DIR_MUST_BE_CLEAN');
  });

  shell.popd('-q');
  shell.rm('-rf', tmp);
  t.end();
});

test('test has upstream error message', async t => {
  shell.rm('-rf', tmp);
  shell.mkdir(tmp);
  shell.pushd('-q', tmp);
  await run('git init');
  await run('touch file1');
  await run('git remote add origin foo');
  await run('git add file1');
  await run('git commit -am "Add file1"');

  await tasks({
    requireUpstream: true
  }).catch(e => {
    t.equal(e.code, 'NO_UPSTREAM');
  });

  shell.popd('-q');
  shell.rm('-rf', tmp);
  t.end();
});

test('test no github token', async t => {
  shell.rm('-rf', tmp);
  shell.mkdir(tmp);
  shell.pushd('-q', tmp);
  await run('git init');
  await run('touch file1');
  await run('git remote add origin foo');
  await run('git add file1');
  await run('git commit -am "Add file1"');

  await tasks({
    requireUpstream: false
  }).catch(e => {
    t.equal(e.code, 'NO_GITHUB_TOKENREF');
  });

  shell.popd('-q');
  shell.rm('-rf', tmp);
  t.end();
});
