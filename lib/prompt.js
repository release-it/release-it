const inquirer = require('inquirer');
const { config } = require('./config');
const { format } = require('./util');
const semver = require('semver');

const { options } = config;

const noop = Promise.resolve();

const prompts = {
  version: {
    type: 'input',
    message: () => 'Please enter a valid version (e.g. 1.0.0):',
    validate: input => !!semver.valid(input) || 'The version must follow the semver standard.'
  },
  ready: {
    type: 'confirm',
    message: (subject, version) => `Ready to release ${format(options[subject].tagName, version)}?`,
    executeTaskIf: false
  },
  status: {
    type: 'confirm',
    message: () => 'Show staged files?'
  },
  commit: {
    type: 'confirm',
    message: (subject, version) => `Commit (${format(options[subject].commitMessage, version)})?`
  },
  tag: {
    type: 'confirm',
    message: (subject, version) => `Tag (${format(options[subject].tagName, version)})?`
  },
  push: {
    type: 'confirm',
    message: () => 'Push?'
  },
  release: {
    type: 'confirm',
    message: (subject, version) => `Create a release on GitHub (${format(options.github.releaseName, version)})?`
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
    message: prompts[promptName].message(subject, options.version),
    default: options.prompt[subject][promptName]
  });

  const answers = await inquirer.prompt([prompt]);

  const doExecute =
    prompt.executeTaskIf !== undefined
      ? prompt.executeTaskIf === answers[promptName]
      : prompt.type === 'confirm'
        ? answers[promptName]
        : true;

  return doExecute ? await task(answers[promptName]) : noop;
};
