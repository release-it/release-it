import test from 'ava';
import sh from 'shelljs';
import Shell from '../lib/shell.js';
import Git from '../lib/plugin/git/Git.js';
import { readJSON } from '../lib/util.js';
import { factory } from './util/index.js';
import { mkTmpDir, gitAdd } from './util/helpers.js';

const { git } = readJSON(new URL('../config/release-it.json', import.meta.url));

test.serial.beforeEach(t => {
  const bare = mkTmpDir();
  const target = mkTmpDir();
  sh.pushd('-q', bare);
  sh.exec(`git init --bare .`);
  sh.exec(`git clone ${bare} ${target}`);
  sh.pushd('-q', target);
  gitAdd('line', 'file', 'Add file');
  t.context = { bare, target };
});

test.serial('should throw if on wrong branch', async t => {
  const options = { git: { requireBranch: 'dev' } };
  const gitClient = factory(Git, { options });
  sh.exec('git remote remove origin');
  await t.throwsAsync(gitClient.init(), { message: /^Must be on branch dev/ });
});

test.serial('should not throw if required branch matches', async t => {
  const options = { git: { requireBranch: 'ma?*' } };
  const gitClient = factory(Git, { options });
  await t.notThrowsAsync(gitClient.init());
});

test.serial('should not throw if one of required branch matches', async t => {
  const options = { git: { requireBranch: ['release/*', 'hotfix/*'] } };
  const gitClient = factory(Git, { options });
  sh.exec('git checkout -b release/v1');
  await t.notThrowsAsync(gitClient.init());
});

test.serial('should throw if there is no remote Git url', async t => {
  const gitClient = factory(Git, { options: { git } });
  sh.exec('git remote remove origin');
  await t.throwsAsync(gitClient.init(), { message: /^Could not get remote Git url/ });
});

test.serial('should throw if working dir is not clean', async t => {
  const gitClient = factory(Git, { options: { git } });
  sh.exec('rm file');
  await t.throwsAsync(gitClient.init(), { message: /^Working dir must be clean/ });
});

test.serial('should throw if no upstream is configured', async t => {
  const gitClient = factory(Git, { options: { git } });
  sh.exec('git checkout -b foo');
  await t.throwsAsync(gitClient.init(), { message: /^No upstream configured for current branch/ });
});

test.serial('should throw if there are no commits', async t => {
  const options = { git: { requireCommits: true } };
  const gitClient = factory(Git, { options });
  sh.exec('git tag 1.0.0');
  await t.throwsAsync(gitClient.init(), { message: /^There are no commits since the latest tag/ });
});

test.serial('should not throw if there are commits', async t => {
  const options = { git: { requireCommits: true } };
  const gitClient = factory(Git, { options });
  sh.exec('git tag 1.0.0');
  gitAdd('line', 'file', 'Add file');
  await t.notThrowsAsync(gitClient.init());
});

test.serial('should not throw if there are no tags', async t => {
  const options = { git: { requireCommits: true } };
  const gitClient = factory(Git, { options });
  gitAdd('line', 'file', 'Add file');
  await t.notThrowsAsync(gitClient.init());
});

test.serial('should not throw if origin remote is renamed', async t => {
  sh.exec('git remote rename origin upstream');
  const gitClient = factory(Git);
  await t.notThrowsAsync(gitClient.init());
});

test.serial('should detect and include version prefix ("v")', async t => {
  const gitClient = factory(Git, { options: { git } });
  sh.exec('git tag v1.0.0');
  await gitClient.init();
  await gitClient.bump('1.0.1');
  t.is(gitClient.config.getContext('tagName'), 'v1.0.1');
});

test.serial('should detect and exclude version prefix', async t => {
  const gitClient = factory(Git, { options: { git } });
  sh.exec('git tag 1.0.0');
  await gitClient.init();
  await gitClient.bump('1.0.1');
  t.is(gitClient.config.getContext('tagName'), '1.0.1');
});

test.serial('should detect and exclude version prefix (configured)', async t => {
  const gitClient = factory(Git, { options: { git: { tagName: 'v${version}' } } });
  sh.exec('git tag 1.0.0');
  await gitClient.init();
  await gitClient.bump('1.0.1');
  t.is(gitClient.config.getContext('tagName'), 'v1.0.1');
});

test.serial('should honor custom tagName configuration', async t => {
  const gitClient = factory(Git, { options: { git: { tagName: 'TAGNAME-${repo.project}-v${version}' } } });
  sh.exec('git tag 1.0.0');
  await gitClient.init();
  await gitClient.bump('1.0.1');
  const { project } = gitClient.getContext('repo');
  t.is(gitClient.config.getContext('tagName'), `TAGNAME-${project}-v1.0.1`);
});

test.serial('should get the latest tag after fetch', async t => {
  const shell = factory(Shell);
  const gitClient = factory(Git, { container: { shell } });
  const { bare, target } = t.context;
  const other = mkTmpDir();
  sh.exec('git push');
  sh.exec(`git clone ${bare} ${other}`);
  sh.pushd('-q', other);
  sh.exec('git tag 1.0.0');
  sh.exec('git push --tags');
  sh.pushd('-q', target);
  await gitClient.init();
  t.is(gitClient.config.getContext('latestTag'), '1.0.0');
});

test.serial('should get the latest custom tag after fetch when tagName is configured', async t => {
  const shell = factory(Shell);
  const gitClient = factory(Git, {
    options: { git: { tagName: 'TAGNAME-v${version}' } },
    container: { shell }
  });
  const { bare, target } = t.context;
  const other = mkTmpDir();
  sh.exec('git push');
  sh.exec(`git clone ${bare} ${other}`);
  sh.pushd('-q', other);
  sh.exec('git tag TAGNAME-OTHER-v2.0.0');
  sh.exec('git tag TAGNAME-v1.0.0');
  sh.exec('git tag TAGNAME-OTHER-v2.0.2');
  sh.exec('git push --tags');
  sh.pushd('-q', target);
  await gitClient.init();
  t.is(gitClient.config.getContext('latestTag'), 'TAGNAME-v1.0.0');
});

test.serial('should get the latest tag based on tagMatch', async t => {
  const shell = factory(Shell);
  const gitClient = factory(Git, {
    options: { git: { tagMatch: '[0-9][0-9]\\.[0-1][0-9]\\.[0-9]*' } },
    container: { shell }
  });
  sh.exec('git tag 1.0.0');
  sh.exec('git tag 21.04.3');
  sh.exec('git tag 1.0.1');
  sh.exec('git push --tags');
  await gitClient.init();
  t.is(gitClient.config.getContext('latestTag'), '21.04.3');
});

test.serial('should generate correct changelog', async t => {
  const gitClient = factory(Git, { options: { git } });
  sh.exec('git tag 1.0.0');
  gitAdd('line', 'file', 'Add file');
  gitAdd('line', 'file', 'Add file');
  await gitClient.init();
  const changelog = await gitClient.getChangelog();
  t.regex(changelog, /\* Add file \(\w{7}\)\n\* Add file \(\w{7}\)/);
});

test.serial('should get the full changelog since latest major tag', async t => {
  const shell = factory(Shell);
  const gitClient = factory(Git, {
    options: { git: { tagMatch: '[0-9]\\.[0-9]\\.[0-9]', changelog: git.changelog } },
    container: { shell }
  });
  sh.exec('git tag 1.0.0');
  gitAdd('line', 'file', 'Add file');
  sh.exec('git tag 2.0.0-rc.0');
  gitAdd('line', 'file', 'Add file');
  sh.exec('git tag 2.0.0-rc.1');
  gitAdd('line', 'file', 'Add file');
  await gitClient.init();
  t.is(gitClient.config.getContext('latestTag'), '1.0.0');
  const changelog = await gitClient.getChangelog();
  t.regex(changelog, /\* Add file \(\w{7}\)\n\* Add file \(\w{7}\)\n\* Add file \(\w{7}\)/);
});
