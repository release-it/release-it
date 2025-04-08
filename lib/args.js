import parseArgs from 'yargs-parser';

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

export const parseCliArguments = args => {
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
