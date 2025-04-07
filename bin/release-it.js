#!/usr/bin/env node

import updater from 'update-notifier';
import parseArgs from 'yargs-parser';
import release from '../lib/cli.js';
import { readJSON } from '../lib/util.js';

const pkg = readJSON(new URL('../package.json', import.meta.url));

const aliases = {
  c: 'config',
  d: 'dry-run',
  h: 'help',
  i: 'increment',
  v: 'version',
  V: 'verbose'
};

const booleanOptions = [
  'dry-run',
  'ci',
  'git',
  'npm',
  'github',
  'gitlab',
  'git.addUntrackedFiles',
  'git.requireCleanWorkingDir',
  'git.requireUpstream',
  'git.requireCommits',
  'git.requireCommitsFail',
  'git.commit',
  'git.tag',
  'git.push',
  'git.getLatestTagFromAllRefs',
  'git.skipChecks',
  'github.release',
  'github.autoGenerate',
  'github.preRelease',
  'github.draft',
  'github.skipChecks',
  'github.web',
  'github.comments.submit',
  'gitlab.release',
  'gitlab.autoGenerate',
  'gitlab.preRelease',
  'gitlab.draft',
  'gitlab.useIdsForUrls',
  'gitlab.useGenericPackageRepositoryForAssets',
  'gitlab.skipChecks',
  'npm.publish',
  'npm.ignoreVersion',
  'npm.allowSameVersion',
  'npm.skipChecks'
];

const parseCliArguments = args => {
  const options = parseArgs(args, {
    boolean: booleanOptions,
    alias: aliases,
    configuration: {
      'parse-numbers': false,
      'camel-case-expansion': false
    }
  });
  if (options.V) {
    options.verbose = typeof options.V === 'boolean' ? options.V : options.V.length;
    delete options.V;
  }
  options.increment = options._[0] || options.i;
  return options;
};

const options = parseCliArguments([].slice.call(process.argv, 2));

updater({ pkg: pkg }).notify();
release(options).then(
  () => process.exit(0),
  ({ code }) => process.exit(Number.isInteger(code) ? code : 1)
);
