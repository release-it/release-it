const path = require('path');
const test = require('ava');
const sinon = require('sinon');
const sh = require('shelljs');
const uuid = require('uuid/v4');
const { gitAdd } = require('./util/index');
const Changelog = require('../lib/changelog');

const cwd = path.resolve(process.cwd());

test.before(t => {
  const name = path.join(cwd, 'tmp', uuid());
  sh.mkdir('-p', name);
  sh.pushd('-q', name);
  sh.exec('git init');
  gitAdd('line', 'file', 'First commit');
  gitAdd('line', 'file', 'Second commit');
  t.context.name = path.basename(name);
});

test.after(() => {
  sh.pushd('-q', cwd);
});

{
  test.serial('should throw for invalid script', async t => {
    const changelogs = new Changelog();
    await t.throwsAsync(changelogs.generate('git log --invalid'), /--invalid/);
  });

  test.serial('should return a default changelog', async t => {
    const changelogs = new Changelog();
    const changelog = await changelogs.generate('git log --pretty=format:"* %s (%h)"');
    t.true(/^\* Second commit \(\w{7}\)\n\* First commit \(\w{7}\)$/.test(changelog));
  });

  test.serial('should return a changelog for the correct commit range', async t => {
    const changelogs = new Changelog();
    sh.exec('git tag 1.0.0');
    gitAdd('line', 'file', 'Third commit');
    gitAdd('line', 'file', 'Fourth commit');
    const changelog = await changelogs.generate('git log --pretty=format:"* %s (%h)" [REV_RANGE]', '1.0.0');
    t.true(/^\* Fourth commit \(\w{7}\)\n\* Third commit \(\w{7}\)$/.test(changelog));
  });
}

test('should return the custom changelog script output', async t => {
  const changelogs = new Changelog();
  const changelog = await changelogs.generate('echo ${name}');
  t.is(changelog, t.context.name);
});

test('should not throw for empty changelog script', async t => {
  const changelogs = new Changelog();
  const changelog = await changelogs.generate();
  t.is(changelog, undefined);
});

test('should return the memoized changelog when requested twice', async t => {
  const spy = sinon.spy(Changelog.prototype, 'generate');
  const changelogs = new Changelog();
  t.is(await changelogs.generate('echo ${name}'), t.context.name);
  t.is(await changelogs.generate('echo ${name}'), t.context.name);
  t.is(spy.calledOnce, true);
  spy.restore();
});
