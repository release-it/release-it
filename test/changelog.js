const path = require('path');
const test = require('tape');
const sh = require('shelljs');
const uuid = require('uuid/v4');
const { gitAdd } = require('./util/index');
const Changelog = require('../lib/changelog');

const cwd = path.resolve(process.cwd());

const changelogs = new Changelog();

test('getChangelog', async t => {
  const tmp = path.join(cwd, 'tmp', uuid());
  sh.mkdir('-p', tmp);
  sh.pushd('-q', tmp);
  sh.exec('git init');
  gitAdd('line', 'file', 'First commit');
  gitAdd('line', 'file', 'Second commit');
  await t.shouldReject(changelogs.create('git log --invalid'), /Could not create changelog/);
  {
    const changelog = await changelogs.create('git log --pretty=format:"* %s (%h)"');
    t.ok(/^\* Second commit \(\w{7}\)\n\* First commit \(\w{7}\)$/.test(changelog));
  }
  {
    sh.exec('git tag 1.0.0');
    gitAdd('line', 'file', 'Third commit');
    gitAdd('line', 'file', 'Fourth commit');
    const changelog = await changelogs.create('git log --pretty=format:"* %s (%h)" [REV_RANGE]', '1.0.0');
    t.ok(/^\* Fourth commit \(\w{7}\)\n\* Third commit \(\w{7}\)$/.test(changelog));
  }
  sh.pushd('-q', cwd);
  t.end();
});

test('getChangelog (custom)', async t => {
  const changelog = await changelogs.create('echo ${name}');
  t.equal(changelog, 'release-it');
  t.end();
});
