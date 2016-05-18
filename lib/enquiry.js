var util = require('./util'),
    config = require('./config'),
    inquirer = require('inquirer'),
    when = require('when'),
    sequence = require('when/sequence');

function shouldPublish(options, subject) {
    var hasDistRepo = !!options.dist.repo;
    if(!options.npm.name || !options.npm.version) {
        return false;
    }
    if(subject === 'src') {
        return !hasDistRepo || options.npm.forcePublishSourceRepo;
    }
    return !options.npm.forcePublishSourceRepo && hasDistRepo;
}

module.exports = function(subject, tasks, options) {

    var noop = when.resolve(true);

    var prompts = {
        status: {
            prompt: {
                type: 'confirm',
                name: 'status',
                message: 'Show updated files?',
                default: false
            },
            task: tasks.status
        },
        commit: {
            prompt: {
                type: 'confirm',
                name: 'commit',
                message: 'Commit (' + util.format(options.commitMessage, options.version) + ')?',
                default: true,
                when: function() {
                    return config.process.get(subject + '_has_changes') !== false;
                }
            },
            task: tasks.commit
        },
        tag: {
            prompt: {
                type: 'confirm',
                name: 'tag',
                message: 'Tag (' + util.format(options.tagName, options.version) + ')?',
                default: true
            },
            task: tasks.tag
        },
        push: {
            prompt: {
                type: 'confirm',
                name: 'push',
                message: 'Push?',
                default: true
            },
            task: sequence.bind(null, [tasks.push, tasks.pushTags])
        },
        release: {
            prompt: {
                type: 'confirm',
                name: 'release',
                message: 'Create a release on GitHub (' + util.format(options.github.releaseName, options.version) + ')?',
                default: true,
                when: function(answers) {
                    return options.github.release
                }
            },
            task: tasks.release
        },
        publish: {
            prompt: {
                type: 'confirm',
                name: 'publish',
                message: 'Publish "' + options.name + '" to npm?',
                default: false,
                when: function() {
                    return !options.npm.private && shouldPublish(options, subject);
                }
            },
            task: tasks.publish
        }
    };

    function getPrompt(prompt, task) {
        return function() {
            return inquirer.prompt(prompt).then(function(answers) {
                return answers[prompt.name] ? task() : noop;
            })
        }
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
