const inquirer = require('inquirer');
const semver = require('semver');
const chalk = require('chalk');
const { config } = require('./config');
const { format, truncateLines } = require('./util');
const { releaseTypes, preReleaseTypes, continuationTypes, isPreRelease } = require('./version');

const { options } = config;

const noop = Promise.resolve();

const getIncrementChoices = () => {
  const types = isPreRelease(options.latestVersion)
    ? [...releaseTypes, continuationTypes[0]]
    : options.preReleaseId
    ? preReleaseTypes
    : [...releaseTypes, ...preReleaseTypes];
  return types
    .map(increment => ({
      name: `${increment} (${semver.inc(options.latestVersion, increment, options.preReleaseId)})`,
      value: increment
    }))
    .concat([
      {
        name: 'Other, please specify...',
        value: null
      }
    ]);
};

const versionTransformer = input =>
  semver.valid(input)
    ? semver.gt(input, options.latestVersion)
      ? chalk.green(input)
      : chalk.red(input)
    : chalk.redBright(input);

const prompts = {
  incrementList: {
    type: 'list',
    message: () => 'Select increment (next version):',
    choices: getIncrementChoices,
    pageSize: 9
  },
  version: {
    type: 'input',
    message: () => `Please enter a valid version:`,
    transformer: versionTransformer,
    validate: input => !!semver.valid(input) || 'The version must follow the semver standard.'
  },
  status: {
    type: 'confirm',
    message: () => 'Show staged files?'
  },
  commit: {
    type: 'confirm',
    message: context => `Commit (${truncateLines(format(context.git.commitMessage), 1, ' [...]')})?`
  },
  tag: {
    type: 'confirm',
    message: context => `Tag (${format(context.git.tagName)})?`
  },
  push: {
    type: 'confirm',
    message: () => 'Push?'
  },
  release: {
    type: 'confirm',
    message: () => `Create a release on GitHub (${format(options.github.releaseName)})?`
  },
  publish: {
    type: 'confirm',
    message: () => `Publish ${options.name} to npm?`
  },
  otp: {
    type: 'input',
    message: () => `Please enter OTP for npm:`
  }
};

module.exports = async (shouldPrompt, subject, promptName, task) => {
  if (!shouldPrompt) return noop;
  const prompt = Object.assign({}, prompts[promptName], {
    name: promptName,
    message: prompts[promptName].message(subject === 'dist' ? options.dist : options),
    default: subject === 'dist' ? options.prompt.dist[promptName] : options.prompt[promptName]
  });

  const answers = await inquirer.prompt([prompt]);

  const doExecute = prompt.type === 'confirm' ? answers[promptName] : true;

  return doExecute ? await task(answers[promptName]) : noop;
};
