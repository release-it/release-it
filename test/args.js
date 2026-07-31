import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseCliArguments } from '../lib/args.js';
import { readJSON } from '../lib/util.js';

const getSchemaOptions = (properties, prefix) =>
  Object.entries(properties).flatMap(([name, schema]) => {
    const path = `${prefix}.${name}`;
    const objectSchema = schema.properties ?? schema.anyOf?.find(option => option.properties);
    const nested = objectSchema?.properties ? getSchemaOptions(objectSchema.properties, path) : [];
    const isObject = schema.type === 'object';
    const hasStringValue = schema.oneOf?.some(option => option.type === 'string' || option.type === 'array');
    const type =
      !hasStringValue && (schema.type === 'boolean' || typeof schema.default === 'boolean') ? 'boolean' : 'string';
    return isObject ? nested : [[path, type], ...nested];
  });

describe('CLI arguments', () => {
  test('parses booleans, negations, aliases, verbosity, and a positional increment', () => {
    const result = parseCliArguments([
      'minor',
      '--dry-run=false',
      '--ci',
      '--github=false',
      '--no-npm',
      '--git.addUntrackedFiles=true',
      '--git.commit=false',
      '--no-git.tag',
      '-VV'
    ]);

    assert.equal(result.increment, 'minor');
    assert.equal(result['dry-run'], false);
    assert.equal(result.d, false);
    assert.equal(result.ci, true);
    assert.equal(result.github, false);
    assert.equal(result.npm, false);
    assert.equal(result.git.addUntrackedFiles, true);
    assert.equal(result.git.commit, false);
    assert.equal(result.git.tag, false);
    assert.equal(result.verbose, 2);
    assert.equal('V' in result, false);
  });

  test('parses string and repeated array options', () => {
    const result = parseCliArguments([
      '-c',
      '.release-it.json',
      '--git.commitMessage=Release ${version}',
      '--git.pushArgs=--follow-tags',
      '--git.pushArgs=--force'
    ]);

    assert.equal(result.config, '.release-it.json');
    assert.equal(result.c, '.release-it.json');
    assert.equal(result.git.commitMessage, 'Release ${version}');
    assert.deepEqual(result.git.pushArgs, ['--follow-tags', '--force']);
  });

  test('parses short options with equals values', () => {
    const result = parseCliArguments(['-c=.release-it.json', '-d=false', '-i=minor', '-V=false']);

    assert.equal(result.config, '.release-it.json');
    assert.equal(result.c, '.release-it.json');
    assert.equal(result['dry-run'], false);
    assert.equal(result.d, false);
    assert.equal(result.increment, 'minor');
    assert.equal(result.i, 'minor');
    assert.equal(result.verbose, false);
  });

  test('keeps a single array option as an array', () => {
    const result = parseCliArguments(['--github.assets=*.zip']);

    assert.deepEqual(result.github.assets, ['*.zip']);
  });

  test('parses dynamic hook options', () => {
    const command = 'echo Successfully released ${name} v${version} to ${repo.repository}.';
    const result = parseCliArguments([
      `--hooks.after:release="${command}"`,
      '--hooks.before:init',
      'npm test',
      '--hooks.before:init=pnpm lint'
    ]);

    assert.equal(result.hooks['after:release'], command);
    assert.deepEqual(result.hooks['before:init'], ['npm test', 'pnpm lint']);
  });

  test('rejects a hook without a command', () => {
    assert.throws(() => parseCliArguments(['--hooks.after:release']), /requires a command/);
  });

  test('parses dynamic plugin options', () => {
    const result = parseCliArguments([
      '--no-plugins.@release-it/keep-a-changelog.strictLatest',
      '--plugins.@release-it/conventional-changelog.preset=angular',
      '--plugins.example.enabled',
      '--plugins.example.value=false',
      '--plugins.example.list=one',
      '--plugins.example.list=two'
    ]);

    assert.equal(result.plugins['@release-it/keep-a-changelog'].strictLatest, false);
    assert.equal(result.plugins['@release-it/conventional-changelog'].preset, 'angular');
    assert.equal(result.plugins.example.enabled, true);
    assert.equal(result.plugins.example.value, 'false');
    assert.deepEqual(result.plugins.example.list, ['one', 'two']);
  });

  test('parses mixed boolean and string options', () => {
    assert.equal(parseCliArguments(['--preRelease']).preRelease, true);
    assert.equal(parseCliArguments(['--preRelease=rc']).preRelease, 'rc');
    assert.equal(parseCliArguments(['--preRelease', 'rc']).preRelease, 'rc');
    assert.equal(parseCliArguments(['--preRelease=false']).preRelease, false);
    assert.equal(parseCliArguments(['--github.makeLatest=legacy']).github.makeLatest, 'legacy');
    assert.equal(parseCliArguments(['--no-increment']).increment, false);
    assert.equal(parseCliArguments(['--no-git.requireBranch']).git.requireBranch, false);
    assert.equal(parseCliArguments(['--no-hooks']).hooks, false);
  });

  test('parses less common public options', () => {
    const result = parseCliArguments([
      '--github.update',
      '--github.releaseNotes.commit="- ${commit.subject}"',
      '--github.releaseNotes.excludeMatches=chore:',
      '--git.tagName=v${version}',
      '--gitlab.certificateAuthorityFileRef=TLS_CA_FILE'
    ]);

    assert.equal(result.github.update, true);
    assert.equal(result.github.releaseNotes.commit, '- ${commit.subject}');
    assert.deepEqual(result.github.releaseNotes.excludeMatches, ['chore:']);
    assert.equal(result.git.tagName, 'v${version}');
    assert.equal(result.gitlab.certificateAuthorityFileRef, 'TLS_CA_FILE');
  });

  test('supports every built-in plugin configuration option', () => {
    for (const namespace of ['git', 'npm', 'github', 'gitlab']) {
      const schema = readJSON(new URL(`../schema/${namespace}.json`, import.meta.url));

      for (const [path, type] of getSchemaOptions(schema.properties, namespace)) {
        const result = parseCliArguments([type === 'boolean' ? `--${path}` : `--${path}=value`]);
        const value = path.split('.').reduce((options, name) => options[name], result);
        assert.notEqual(value, undefined, path);
      }
    }
  });

  test('parses an increment after the option terminator', () => {
    assert.equal(parseCliArguments(['--', 'minor']).increment, 'minor');
  });

  test('rejects config without a value', () => {
    assert.throws(
      () =>
        parseCliArguments([
          '--ci',
          '--no-git.commit',
          '--no-npm.publish',
          '--config',
          '--git.pushRepo=gitlab',
          '.release-it.ts',
          '--preRelease'
        ]),
      error => {
        assert.equal(error.code, 'ERR_PARSE_ARGS_INVALID_OPTION_VALUE');
        assert.match(error.message, /--config/);
        return true;
      }
    );
  });

  test('rejects unknown options', () => {
    assert.throws(
      () => parseCliArguments(['--git.comit']),
      error => {
        assert.equal(error.code, 'ERR_PARSE_ARGS_UNKNOWN_OPTION');
        assert.match(error.message, /--git\.comit/);
        return true;
      }
    );
  });

  test('rejects invalid boolean values', () => {
    assert.throws(
      () => parseCliArguments(['--git.commit=maybe']),
      error => {
        assert.equal(error.code, 'ERR_PARSE_ARGS_INVALID_OPTION_VALUE');
        assert.match(error.message, /--git\.commit/);
        return true;
      }
    );
  });

  test('rejects extra positional arguments', () => {
    assert.throws(() => parseCliArguments(['minor', 'extra']), /Unexpected positional argument "extra"/);
  });

  test('rejects conflicting parent and nested options', () => {
    assert.throws(() => parseCliArguments(['--github', '--github.release']), /Conflicting option/);
    assert.throws(() => parseCliArguments(['--github.release', '--github']), /Conflicting option/);
  });

  for (const path of ['plugins.__proto__.polluted', 'plugins.foo.constructor.prototype.polluted']) {
    test(`rejects unsafe option path ${path}`, () => {
      assert.throws(() => parseCliArguments([`--${path}=true`]), /Unsafe option path/);
      assert.equal(Object.prototype.polluted, undefined);
    });
  }

  test('prints parser errors without a stack trace', () => {
    const bin = fileURLToPath(new URL('../bin/release-it.js', import.meta.url));
    const result = spawnSync(process.execPath, [bin, '--config', '--ci'], { encoding: 'utf8' });

    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /^ERROR .+--config.+\n$/s);
    assert.doesNotMatch(result.stderr, /\n\s+at /);
  });
});
