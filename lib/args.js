import { parseArgs } from 'node:util';

const aliases = {
  c: 'config',
  d: 'dry-run',
  h: 'help',
  i: 'increment',
  v: 'version',
  V: 'verbose'
};

const booleanOptionNames = [
  'changelog',
  'ci',
  'dry-run',
  'git',
  'github',
  'gitlab',
  'help',
  'npm',
  'only-version',
  'preRelease',
  'quiet',
  'release-version',
  'snapshot',
  'version',
  'git.addUntrackedFiles',
  'git.commit',
  'git.getLatestTagFromAllRefs',
  'git.push',
  'git.requireCleanWorkingDir',
  'git.requireCommits',
  'git.requireCommitsFail',
  'git.requireUpstream',
  'git.tag',
  'npm.allowSameVersion',
  'npm.ignoreVersion',
  'npm.publish',
  'npm.skipChecks',
  'npm.stage',
  'github.autoGenerate',
  'github.comments.submit',
  'github.discussionCategoryName',
  'github.draft',
  'github.makeLatest',
  'github.preRelease',
  'github.release',
  'github.skipChecks',
  'github.update',
  'github.web',
  'gitlab.autoGenerate',
  'gitlab.draft',
  'gitlab.preRelease',
  'gitlab.release',
  'gitlab.secure',
  'gitlab.skipChecks',
  'gitlab.useGenericPackageRepositoryForAssets',
  'gitlab.useIdsForUrls'
];

const stringOptionNames = [
  'config',
  'configDir',
  'extends',
  'increment',
  'preReleaseBase',
  'preReleaseId',
  'git.changelog',
  'git.commitsPath',
  'git.commitMessage',
  'git.pushRepo',
  'git.tagAnnotation',
  'git.tagExclude',
  'git.tagMatch',
  'git.tagName',
  'npm.otp',
  'npm.publishPackageManager',
  'npm.publishPath',
  'npm.tag',
  'npm.timeout',
  'github.comments.issue',
  'github.comments.pr',
  'github.host',
  'github.proxy',
  'github.releaseName',
  'github.releaseNotes',
  'github.releaseNotes.commit',
  'github.timeout',
  'github.tokenRef',
  'gitlab.certificateAuthorityFile',
  'gitlab.certificateAuthorityFileRef',
  'gitlab.genericPackageRepositoryName',
  'gitlab.origin',
  'gitlab.releaseName',
  'gitlab.releaseNotes',
  'gitlab.repoId',
  'gitlab.tokenHeader',
  'gitlab.tokenRef'
];

const arrayOptionNames = [
  'git.commitArgs',
  'git.requireBranch',
  'git.pushArgs',
  'git.tagArgs',
  'npm.publishArgs',
  'npm.versionArgs',
  'github.assets',
  'github.releaseNotes.excludeMatches',
  'gitlab.assets',
  'gitlab.milestones'
];

const mixedOptionNames = new Set(['preRelease', 'snapshot', 'github.discussionCategoryName', 'github.makeLatest']);
const collapsibleArrayOptionNames = new Set(['git.requireBranch']);
const arrayOptionNameSet = new Set(arrayOptionNames);
const unsafePathSegments = new Set(['__proto__', 'constructor', 'prototype']);

const baseParseOptions = Object.fromEntries([
  ...booleanOptionNames.map(name => [name, { type: 'boolean' }]),
  ...stringOptionNames.map(name => [name, { type: 'string' }]),
  ...arrayOptionNames.map(name => [name, { type: 'string', multiple: true }])
]);

Object.assign(baseParseOptions, {
  config: { type: 'string', short: 'c' },
  'dry-run': { type: 'boolean', short: 'd' },
  help: { type: 'boolean', short: 'h' },
  increment: { type: 'string', short: 'i' },
  verbose: { type: 'boolean', short: 'V', multiple: true },
  version: { type: 'boolean', short: 'v' }
});

const argumentError = message => Object.assign(new TypeError(message), { code: 'ERR_PARSE_ARGS_INVALID_OPTION_VALUE' });

const getOptionToken = token => {
  const negated = token.name.startsWith('no-');
  const rawName = negated ? token.name.slice(3) : token.name;
  return { name: aliases[rawName] ?? rawName, negated };
};

const getAdjacentPositional = (tokens, index, optionIndex) => {
  const token = tokens[index + 1];
  return token?.kind === 'positional' && token.index === optionIndex + 1 ? token : null;
};

const isBooleanValue = value => value === 'true' || value === 'false';

const assertSafePath = path => {
  const segments = path.split('.');

  if (segments.some(segment => !segment)) {
    throw argumentError(`Invalid option path "${path}".`);
  }

  if (segments.some(segment => unsafePathSegments.has(segment))) {
    throw argumentError(`Unsafe option path "${path}".`);
  }
};

const normalizeOptionSyntax = args =>
  args.map(arg => {
    if (!arg.startsWith('-')) return arg;

    const shortOption = arg[1] !== '-' && arg[2] === '=' ? aliases[arg[1]] : undefined;
    const normalizedArg = shortOption ? `--${shortOption}${arg.slice(2)}` : arg;
    const separatorIndex = normalizedArg.indexOf('=');
    if (separatorIndex === -1) return normalizedArg;

    const value = normalizedArg.slice(separatorIndex + 1);
    const quote = value[0];
    return value.length >= 2 && (quote === '"' || quote === "'") && value.at(-1) === quote
      ? `${normalizedArg.slice(0, separatorIndex + 1)}${value.slice(1, -1)}`
      : normalizedArg;
  });

const discoverDynamicOptions = tokens => {
  const dynamicOptions = new Map();

  for (const [index, token] of tokens.entries()) {
    if (token.kind !== 'option') continue;

    const { name, negated } = getOptionToken(token);
    if (!name.startsWith('hooks.') && !name.startsWith('plugins.')) continue;

    assertSafePath(name);

    const positional = getAdjacentPositional(tokens, index, token.index);
    const hasValue = Boolean(positional || token.inlineValue);

    if (name.startsWith('hooks.') && !negated && !hasValue) {
      throw argumentError(`Option "--${name}" requires a command.`);
    }

    const type = negated || (!name.startsWith('hooks.') && !hasValue) ? 'boolean' : 'string';
    const option = dynamicOptions.get(name);

    if (option && option.type !== type) {
      throw argumentError(`Option "--${name}" cannot be used as both a boolean and a string.`);
    }

    dynamicOptions.set(name, { type, count: (option?.count ?? 0) + 1 });
  }

  return Object.fromEntries(
    [...dynamicOptions].map(([name, { type, count }]) => [name, { type, ...(count > 1 && { multiple: true }) }])
  );
};

const addNegativeOptions = parseOptions => {
  for (const [name, option] of Object.entries(parseOptions)) {
    if (option.type === 'string') parseOptions[`no-${name}`] = { type: 'boolean' };
  }

  return parseOptions;
};

const normalizeArguments = (args, tokens, parseOptions) => {
  const normalizedArgs = [...args];
  const consumedIndexes = new Set();
  const mixedValues = new Map();

  for (const [index, token] of tokens.entries()) {
    if (token.kind !== 'option') continue;

    const { name, negated } = getOptionToken(token);
    const option = parseOptions[name];
    if (!option) continue;

    const positional = getAdjacentPositional(tokens, index, token.index);

    if (mixedOptionNames.has(name)) {
      const value = negated
        ? false
        : token.inlineValue
          ? isBooleanValue(token.value)
            ? token.value === 'true'
            : token.value
          : positional
            ? positional.value
            : true;

      mixedValues.set(name, value);
      normalizedArgs[token.index] = value === false ? `--no-${name}` : `--${name}`;
      if (positional) consumedIndexes.add(positional.index);
      continue;
    }

    if (option.type === 'boolean') {
      const value = token.inlineValue ? token.value : positional?.value;
      if (isBooleanValue(value)) {
        normalizedArgs[token.index] = value === 'true' ? `--${name}` : `--no-${name}`;
        if (positional) consumedIndexes.add(positional.index);
      }
    }
  }

  return {
    args: normalizedArgs.filter((_, index) => !consumedIndexes.has(index)),
    mixedValues
  };
};

const normalizeVerbose = values => {
  if (!Array.isArray(values)) return values;
  const lastDisabled = values.lastIndexOf(false);
  const count = values.slice(lastDisabled + 1).filter(Boolean).length;
  return count || false;
};

const setNestedOption = (options, path, value) => {
  assertSafePath(path);

  const parts = path.split('.');
  const name = parts.pop();
  let target = options;

  for (const part of parts) {
    if (!Object.hasOwn(target, part)) target[part] = {};
    if (!target[part] || typeof target[part] !== 'object' || Array.isArray(target[part])) {
      throw argumentError(`Conflicting option "--${path}".`);
    }
    target = target[part];
  }

  if (Object.hasOwn(target, name) && target[name] && typeof target[name] === 'object') {
    throw argumentError(`Conflicting option "--${path}".`);
  }

  target[name] = value;
};

export const parseCliArguments = args => {
  const syntaxArgs = normalizeOptionSyntax(args);
  const { tokens } = parseArgs({ args: syntaxArgs, strict: false, allowPositionals: true, tokens: true });
  const parseOptions = addNegativeOptions({ ...baseParseOptions, ...discoverDynamicOptions(tokens) });
  const normalized = normalizeArguments(syntaxArgs, tokens, parseOptions);
  const { values, positionals } = parseArgs({
    args: normalized.args,
    options: parseOptions,
    strict: true,
    allowNegative: true,
    allowPositionals: true
  });

  for (const [name, value] of normalized.mixedValues) values[name] = value;

  if (positionals.length > 1) {
    throw argumentError(`Unexpected positional argument "${positionals[1]}".`);
  }

  const options = { _: positionals };

  for (const [name, rawValue] of Object.entries(values)) {
    const value =
      arrayOptionNameSet.has(name) && rawValue.length === 1 && rawValue[0] === false
        ? false
        : collapsibleArrayOptionNames.has(name) && rawValue.length === 1
          ? rawValue[0]
          : name === 'verbose'
            ? normalizeVerbose(rawValue)
            : rawValue;
    setNestedOption(options, name, value);
  }

  for (const [short, name] of Object.entries(aliases)) {
    if (short !== 'V' && options[name] !== undefined) options[short] = options[name];
  }

  options.increment = positionals[0] ?? options.increment;
  return options;
};
