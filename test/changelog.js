const path = require('path');
const test = require('ava');
const sh = require('shelljs');
const uuid = require('uuid/v4');
const { gitAdd } = require('./util/index');
const Changelog = require('../lib/changelog');

const cwd = path.resolve(process.cwd());

const changelogs = new Changelog();

test.serial('getChangelog', async t => {
  const tmp = path.join(cwd, 'tmp', uuid());
  sh.mkdir('-p', tmp);
  sh.pushd('-q', tmp);
  sh.exec('git init');
  gitAdd('line', 'file', 'First commit');
  gitAdd('line', 'file', 'Second commit');
  await t.throwsAsync(changelogs.create('git log --invalid'), /--invalid/);
  {
    const changelog = await changelogs.create('git log --pretty=format:"* %s (%h)"');
    t.true(/^\* Second commit \(\w{7}\)\n\* First commit \(\w{7}\)$/.test(changelog));
  }
  {
    sh.exec('git tag 1.0.0');
    gitAdd('line', 'file', 'Third commit');
    gitAdd('line', 'file', 'Fourth commit');
    const changelog = await changelogs.create('git log --pretty=format:"* %s (%h)" [REV_RANGE]', '1.0.0');
    t.true(/^\* Fourth commit \(\w{7}\)\n\* Third commit \(\w{7}\)$/.test(changelog));
  }
  sh.pushd('-q', cwd);
});

test('getChangelog (custom)', async t => {
  const changelog = await changelogs.create('echo ${name}');
  t.is(changelog, 'release-it');
});
