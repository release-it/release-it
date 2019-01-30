const inquirer = require('inquirer');
const semver = require('semver');
const chalk = require('chalk');
const Config = require('./config');
const { format, truncateLines } = require('./util');
const { releaseTypes, preReleaseTypes, continuationTypes } = require('./version');

const { valid, gt } = semver;
const { green, red, redBright } = chalk;
const noop = Promise.resolve();

const t = {
  latestIsPreRelease: [...releaseTypes, continuationTypes[0]],
  preRelease: preReleaseTypes,
  default: [...releaseTypes, ...preReleaseTypes]
};

const getIncrementChoices = context => {
  const types = context.latestIsPreRelease ? t.latestIsPreRelease : context.preRelease ? t.preRelease : t.default;
  const choices = types.map(increment => ({
    name: `${increment} (${semver.inc(context.latestVersion, increment, context.preReleaseId)})`,
    value: increment
  }));
  const otherChoice = {
    name: 'Other, please specify...',
    value: null
  };
  return [...choices, otherChoice];
};

const versionTransformer = context => input =>
  valid(input) ? (gt(input, context.latestVersion) ? green(input) : red(input)) : redBright(input);

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
  ghRelease: {
    type: 'confirm',
    message: context =>
      `Create a ${context.isPreRelease ? 'pre-' : ''}release on GitHub (${format(
        context.github.releaseName,
        context
      )})?`
  },
  glRelease: {
    type: 'confirm',
    message: context => `Create a release on GitLab (${format(context.gitlab.releaseName, context)})?`
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

class Prompt {
  constructor(injected = {}) {
    this.config = injected.config || new Config();
    this.createPrompt = (injected.inquirer || inquirer).prompt;
  }

  async show({ enabled = true, prompt: promptName, task }) {
    if (!enabled) return noop;

    const context = this.config.getOptions();
    const prompt = prompts[promptName];
    const options = Object.assign({}, prompt, {
      name: promptName,
      message: prompt.message(context),
      choices: 'choices' in prompt && prompt.choices(context),
      transformer: 'transformer' in prompt && prompt.transformer(context),
      default: !('prompt' in context && context.prompt[promptName] === false)
    });

    const answers = await this.createPrompt([options]);

    const doExecute = prompt.type === 'confirm' ? answers[promptName] : true;

    return doExecute && task ? await task(answers[promptName]) : noop;
  }
}

module.exports = Prompt;
