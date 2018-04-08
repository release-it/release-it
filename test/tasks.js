const tasks = require('../lib/tasks');
const test = require('tape');
const shell = require('shelljs');
const { run, copy } = require('../lib/shell');

const tmp = 'test/resources/tmp';

test('test not-a-git-repo error message', async t => {
  shell.pushd('-q', '..');
  // await run('touch file1');
  // await run('git add file1');
  // await run('git commit -am "Add file1"');

  let options = {
    errors: {
      'not-a-git-repo': 'Not a repo man!'
    }
  };

  await tasks(options).catch(e => {
    t.equal(e.message, options.errors['not-a-git-repo']);
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

  let options = {
    errors: {
      'no-remote-git-url': 'no remote...'
    }
  };

  await tasks(options).catch(e => {
    t.equal(e.message, options.errors['no-remote-git-url']);
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

  let options = {
    errors: {
      'working-dir-must-be-clean': 'Not clean - Not cool!'
    }
  };

  await tasks(options).catch(e => {
    t.equal(e.message, options.errors['working-dir-must-be-clean']);
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

  let options = {
    errors: {
      'no-upstream': 'Cant find upstream'
    },
    requireUpstream: true
  };

  await tasks(options).catch(e => {
    t.equal(e.message, options.errors['no-upstream']);
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

  let options = {
    requireUpstream: false
  };

  await tasks(options).catch(e => {
    t.ok(e.message.indexOf('GITHUB_TOKEN') >= 0);
  });

  shell.popd('-q');
  shell.rm('-rf', tmp);
  t.end();
});
