const util = require('./util'),
  config = require('./config'),
  inquirer = require('inquirer'),
  sequence = require('when/sequence');

function shouldPublish(options, subject) {
  const hasDistRepo = !!options.dist.repo;
  if(!options.npm.name || !options.npm.version) {
    return false;
  }
  if(subject === 'src') {
    return !hasDistRepo || options.npm.forcePublishSourceRepo;
  }
  return !options.npm.forcePublishSourceRepo && hasDistRepo;
}

module.exports = (subject, tasks, options) => {

  const version = config.getRuntimeOption('version');
  const noop = Promise.resolve();

  const prompts = {
    status: {
      prompt: {
        type: 'confirm',
        name: 'status',
        message: 'Show updated files?',
        default: options.prompt[subject].status
      },
      task: tasks.status
    },
    commit: {
      prompt: {
        type: 'confirm',
        name: 'commit',
        message: `Commit (${util.format(options[subject].commitMessage, version)})?`,
        default: options.prompt[subject].commit,
        when: function() {
          return config.getRuntimeOption(`${subject}_has_changes`) !== false;
        }
      },
      task: tasks.commit
    },
    tag: {
      prompt: {
        type: 'confirm',
        name: 'tag',
        message: `Tag (${util.format(options[subject].tagName, version)})?`,
        default: options.prompt[subject].tag
      },
      task: tasks.tag
    },
    push: {
      prompt: {
        type: 'confirm',
        name: 'push',
        message: 'Push?',
        default: options.prompt[subject].push
      },
      task: tasks.push
    },
    release: {
      prompt: {
        type: 'confirm',
        name: 'release',
        message: `Create a release on GitHub (${util.format(options.github.releaseName, version)})?`,
        default: options.prompt[subject].release,
        when: function() {
          return options.github.release
        }
      },
      task: sequence.bind(null, [tasks.release, tasks.uploadAssets])
    },
    publish: {
      prompt: {
        type: 'confirm',
        name: 'publish',
        message: `Publish "${options.name}" to npm?`,
        default: options.prompt[subject].publish,
        when: function() {
          return !options.npm.private && shouldPublish(options, subject);
        }
      },
      task: tasks.publish
    }
  };

  function getPrompt(prompt, task) {
    return () => inquirer.prompt(prompt).then(answers => answers[prompt.name] ? task() : noop);
  }

  return sequence([
    getPrompt(prompts.status.prompt, prompts.status.task),
    getPrompt(prompts.commit.prompt, prompts.commit.task),
    getPrompt(prompts.tag.prompt, prompts.tag.task),
    getPrompt(prompts.push.prompt, prompts.push.task),
    getPrompt(prompts.release.prompt, prompts.release.task),
    getPrompt(prompts.publish.prompt, prompts.publish.task)
  ]);
};
