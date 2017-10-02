import inquirer from 'inquirer';
import { config } from './config';
import { format } from './util';

const { options } = config;

const noop = Promise.resolve();

const prompts = {
  version: {
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
    message: (subject, version) =>
      `Changelog OK? Create a release on GitHub (${format(options.github.releaseName, version)})?`
  },
  publish: {
    type: 'confirm',
    message: () => `Publish ${options.name} to npm?`
  }
};

export default async function(subject, promptName, task) {
  const prompt = Object.assign({}, prompts[promptName], {
    name: promptName,
    message: prompts[promptName].message(subject, options.version),
    default: options.prompt[subject][promptName],
    executeTaskIf: prompts[promptName].executeTaskIf !== false
  });

  const answers = await inquirer.prompt([prompt]);

  return answers[promptName] === prompt.executeTaskIf ? await task() : noop;
}
