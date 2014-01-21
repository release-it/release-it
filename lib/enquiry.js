var util = require('util'),
    inquirer = require('inquirer'),
    when = require('when'),
    sequence = require('when/sequence');

module.exports = function(subject, tasks, options) {

    var enquiry = when.defer(),
        noop = when.resolve(true);

    // TODO: Fix abusing the "when" feature of Inquiry.js prompts (https://github.com/SBoudrias/Inquirer.js/issues/89)

    inquirer.prompt([{
        type: 'confirm',
        name: 'status',
        message: 'Show updated files?',
        default: false
    }, {
        type: 'confirm',
        name: 'commit',
        message: 'Commit (' + util.format(options.commitMessage, options.version) + ')?',
        default: true,
        when: status
    }, {
        type: 'confirm',
        name: 'tag',
        message: 'Tag (' + util.format(options.tagName, options.version) + ')?',
        default: true,
        when: commit
    }, {
        type: 'confirm',
        name: 'push',
        message: 'Push?',
        default: true,
        when: tag
    }, {
        type: 'confirm',
        name: 'publish',
        message: 'Publish "' + options.name + '" to npm?',
        default: false,
        when: push
    }], publish);

    function status(answers) {
        var execute = answers.status ? tasks.status() : noop,
            done = this.async().bind(this, true);
        execute.catch(enquiry.reject).then(done);
    }

    function commit(answers) {
        var execute = answers.commit ? tasks.commit() : noop,
            done = this.async().bind(this, answers.commit);
        execute.catch(enquiry.reject).then(done);
    }

    function tag(answers) {
        var execute = answers.tag ? tasks.tag() : noop,
            done = this.async().bind(this, answers.commit);
        execute.catch(enquiry.reject).then(done);
    }

    function push(answers) {
        var execute = answers.push ? sequence([tasks.push, tasks.pushTags]) : noop,
            result = (subject === 'src' && !options.distRepo) || (subject === 'dist' && !!options.distRepo),
            done = this.async().bind(this, result);
        execute.catch(enquiry.reject).then(done);
    }

    function publish(answers) {
        var execute = answers.publish ? tasks.publish() : noop;
        execute.then(enquiry.resolve, enquiry.reject);
    }

    return enquiry.promise;

};
