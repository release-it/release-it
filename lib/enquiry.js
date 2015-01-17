var util = require('util'),
    inquirer = require('inquirer'),
    when = require('when'),
    sequence = require('when/sequence');

function shouldPublish(distRepo, subject) {
    var hasDistRepo = !!distRepo;
    return (subject === 'src' && !hasDistRepo) || (subject === 'dist' && hasDistRepo);
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
                default: true
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
        publish: {
            prompt: {
                type: 'confirm',
                name: 'publish',
                message: 'Publish "' + options.name + '" to npm?',
                default: false,
                when: function() {
                    return !options.private && shouldPublish(options.distRepo, subject);
                }
            },
            task: tasks.publish
        }
    };

    function getPrompt(prompt, task) {
        return function() {
            return when.promise(function(resolve) {
                inquirer.prompt(prompt, function(answers) {
                    resolve(answers[prompt.name] ? task() : noop)
                })
            })
        }
    }

    return sequence([
        getPrompt(prompts.status.prompt, prompts.status.task),
        getPrompt(prompts.commit.prompt, prompts.commit.task),
        getPrompt(prompts.tag.prompt, prompts.tag.task),
        getPrompt(prompts.push.prompt, prompts.push.task),
        getPrompt(prompts.publish.prompt, prompts.publish.task)
    ]);
};
