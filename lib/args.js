import { parseArgs } from 'node:util';

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
  'quiet',
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

const configOptions = new Set(['--config', '-c']);
const booleanOptionSet = new Set([...booleanOptions, 'help', 'version', 'verbose']);

const parseOptions = Object.fromEntries(booleanOptions.map(option => [option, { type: 'boolean' }]));

Object.assign(parseOptions, {
  config: { type: 'string', short: 'c' },
  'dry-run': { type: 'boolean', short: 'd' },
  help: { type: 'boolean', short: 'h' },
  increment: { type: 'string', short: 'i' },
  version: { type: 'boolean', short: 'v' },
  verbose: { type: 'boolean', short: 'V', multiple: true }
});

const validateConfigOption = args => {
  const index = args.findIndex(arg => configOptions.has(arg));
  const value = args[index + 1];

  if (index !== -1 && (!value || value.startsWith('-'))) {
    throw new Error('Invalid argument: "--config" must be immediately followed by the configuration file name.');
  }
};

const setDottedOption = (options, key, value) => {
  const parts = key.split('.');
  const name = parts.pop();
  const target = parts.reduce((options, part) => {
    if (options[part] === undefined) options[part] = {};
    return options[part];
  }, options);

  target[name] = value;
};

const setAliasOptions = options => {
  for (const [short, name] of Object.entries(aliases)) {
    if (options[name] !== undefined) options[short] = options[name];
  }
};

const normalizeBooleanValue = (key, value) => {
  if (!booleanOptionSet.has(key)) return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
};

const normalizeOptions = ({ values, tokens }) => {
  const consumedPositionals = new Set();
  const normalizedValues = Object.fromEntries(Object.entries(values));

  for (const [index, token] of tokens.entries()) {
    const nextToken = tokens[index + 1];

    if (
      token.kind === 'option' &&
      !booleanOptionSet.has(token.name) &&
      normalizedValues[token.name] === true &&
      nextToken?.kind === 'positional' &&
      nextToken.index === token.index + 1
    ) {
      normalizedValues[token.name] = nextToken.value;
      consumedPositionals.add(nextToken.index);
    }
  }

  const options = {
    _: tokens
      .filter(token => token.kind === 'positional' && !consumedPositionals.has(token.index))
      .map(token => token.value)
  };

  for (const [key, value] of Object.entries(normalizedValues)) {
    setDottedOption(options, key, normalizeBooleanValue(key, value));
  }

  setAliasOptions(options);

  return options;
};

export const parseCliArguments = args => {
  validateConfigOption(args);

  const options = normalizeOptions(
    parseArgs({
      args,
      allowNegative: true,
      allowPositionals: true,
      options: parseOptions,
      strict: false,
      tokens: true
    })
  );

  if (Array.isArray(options.verbose)) {
    options.verbose = options.verbose.length;
  }
  options.increment = options._[0] || options.i;
  return options;
};
