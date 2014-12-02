var optimist = require('optimist'),
    log = require('./log'),
    pkg = require('../package.json'),
    version = pkg.version;

optimist.usage('Release It! v' + version +'\n\n' +
    'Usage: $0 <increment> [options]\n\n' +
    'Use e.g. "$0 minor" directly as shorthand for "$0 --increment=minor".');

optimist.alias('c', 'config');
optimist.describe('c', 'Path to local configuration options [default: ".release.json"]');

optimist.boolean('d');
optimist.alias('d', 'dry-run');
optimist.describe('d', 'Do not touch or write anything, but show the commands and interactivity');

optimist.boolean('e');
optimist.alias('e', 'debug');
optimist.describe('e', 'Output exceptions');

optimist.boolean('f');
optimist.alias('f', 'force');
optimist.describe('f', 'Force tagging with Git');

optimist.boolean('h');
optimist.alias('h', 'help');
optimist.describe('h', 'Print help');

optimist.alias('i', 'increment');
optimist.describe('i', 'Incrementing "major", "minor", or "patch" version; or specify version [default: "patch"]');

optimist.string('m');
optimist.alias('m', 'message');
optimist.describe('m', 'Commit message [default: "Release %s"]');

optimist.boolean('n');
optimist.alias('n', 'non-interactive');
optimist.describe('n', 'No interaction (assume default answers to questions)');

optimist.boolean('p');
optimist.alias('p', 'publish');
optimist.describe('p', 'Publish to npm (only in --non-interactive mode)');

optimist.boolean('v');
optimist.alias('v', 'version');
optimist.describe('v', 'Print version number');

optimist.boolean('V');
optimist.alias('V', 'verbose');
optimist.describe('V', 'Verbose output');

module.exports = {
    version: function() {
        log.log('v' + version);
    },
    help: function() {
        log.log(optimist.help());

    },
    parse: function(argv) {
        var options = optimist.parse(argv);
        if(options._[0] && !options.increment) {
            options.increment = options.i = options._[0];
        }
        options.commitMessage = options.message;
        return options;
    }
};
