import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import GitBase from '../lib/plugin/GitBase.js';
import Shell from '../lib/shell.js';

for (const isDryRun of [false, true]) {
  for (const hasTag of [false, true]) {
    test(`changelog ${isDryRun ? 'dry-run' : 'normal run'} ${hasTag ? 'after a tag' : 'without tags'}`, async t => {
      const previousDirectory = process.cwd();
      const directory = mkdtempSync(path.join(tmpdir(), 'release-it-changelog-'));
      t.after(() => {
        process.chdir(previousDirectory);
        rmSync(directory, { recursive: true });
      });
      const git = args =>
        execFileSync(
          'git',
          [
            '-c',
            'core.hooksPath=/dev/null',
            '-c',
            'commit.gpgsign=false',
            '-c',
            'user.name=Release Test',
            '-c',
            'user.email=test@example.invalid',
            ...args
          ],
          { cwd: directory, encoding: 'utf8', timeout: 5000 }
        ).trim();
      git(['init', '-q', '-b', 'test/changelog']);
      writeFileSync(path.join(directory, 'file'), 'initial\n');
      git(['add', 'file']);
      git(['commit', '-q', '-m', 'initial change']);
      if (hasTag) git(['tag', 'v1.0.0']);
      writeFileSync(path.join(directory, 'file'), 'second\n');
      git(['commit', '-qam', 'second change']);
      const head = git(['rev-parse', 'HEAD']);
      process.chdir(directory);

      const context = {};
      const config = { isDryRun, isIncrement: true, getContext: () => context };
      const log = { exec: t.mock.fn(), verbose: () => {}, log: () => {} };
      const shell = new Shell({ container: { config, log } });
      const plugin = new GitBase({
        namespace: 'git',
        options: { git: { changelog: 'git log --pretty=format:"* %s (%h)" ${from}...${to}' } },
        container: { config, log, shell }
      });
      context.latestTag = await plugin.getLatestTagName();
      assert.equal(context.latestTag, hasTag ? 'v1.0.0' : null);

      const changelog = await plugin.getChangelog();
      assert.equal(typeof changelog, 'string');
      assert.deepEqual(
        changelog.split('\n').map(line => line.replace(/ \([a-f0-9]+\)$/, '')),
        hasTag ? ['* second change'] : ['* second change', '* initial change']
      );
      const command = log.exec.mock.calls.find(call => String(call.arguments[0]).startsWith('git log'));
      assert.ok(command);
      assert.notEqual(command.arguments[1].isDryRun, true);
      assert.equal(git(['rev-parse', 'HEAD']), head);
      assert.equal(git(['status', '--porcelain']), '');
    });
  }
}
