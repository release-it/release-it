const inquirer = require('inquirer');
const semver = require('semver');
const chalk = require('chalk');
const { format, truncateLines } = require('./util');
const { releaseTypes, preReleaseTypes, continuationTypes } = require('./version');

const noop = Promise.resolve();

const getIncrementChoices = context => {
  const types = context.latestIsPreRelease
    ? [...releaseTypes, continuationTypes[0]]
    : context.isPreRelease
    ? preReleaseTypes
    : [...releaseTypes, ...preReleaseTypes];
  return types
    .map(increment => ({
      name: `${increment} (${semver.inc(context.latestVersion, increment, context.preReleaseId)})`,
      value: increment
    }))
    .concat([
      {
        name: 'Other, please specify...',
        value: null
      }
    ]);
};

const versionTransformer = context => input =>
  semver.valid(input)
    ? semver.gt(input, context.latestVersion)
      ? chalk.green(input)
      : chalk.red(input)
    : chalk.redBright(input);

const prompts = {
  incrementList: {
    type: 'list',
    message: () => 'Select increment (next version):',
    choices: context => getIncrementChoices(context),
    pageSize: 9
  },
  version: {
    type: 'input',
    message: () => `Please enter a valid version:`,
    transformer: context => versionTransformer(context),
    validate: input => !!semver.valid(input) || 'The version must follow the semver standard.'
  },
  commit: {
    type: 'confirm',
    message: context => `Commit (${truncateLines(format(context.git.commitMessage, context), 1, ' [...]')})?`
  },
  tag: {
    type: 'confirm',
    message: context => `Tag (${format(context.git.tagName, context)})?`
  },
  push: {
    type: 'confirm',
    message: () => 'Push?'
  },
  release: {
    type: 'confirm',
    message: context =>
      `Create a ${context.isPreRelease ? 'pre-' : ''}release on GitHub (${format(
        context.github.releaseName,
        context
      )})?`
  },
  publish: {
    type: 'confirm',
    message: context => `Publish ${context.name}${context.npm.tag === 'latest' ? '' : `@${context.npm.tag}`} to npm?`
  },
  otp: {
    type: 'input',
    message: () => `Please enter OTP for npm:`
  }
};

module.exports = async (shouldPrompt, context, promptName, task) => {
  if (!shouldPrompt) return noop;
  const prompt = Object.assign({}, prompts[promptName], {
    name: promptName,
    message: prompts[promptName].message(context),
    choices: 'choices' in prompts[promptName] && prompts[promptName].choices(context),
    transformer: 'transformer' in prompts[promptName] && prompts[promptName].transformer(context),
    default: context.prompt[promptName]
  });

  const answers = await inquirer.prompt([prompt]);

  const doExecute = prompt.type === 'confirm' ? answers[promptName] : true;

  return doExecute ? await task(answers[promptName]) : noop;
};
