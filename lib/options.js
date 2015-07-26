var parseArgs = require('minimist'),
    _ = require('lodash'),
    log = require('./log'),
    pkg = require('../package.json'),
    version = pkg.version;

var helpText = [
    'Release It! v' + version,
    '',
    'Usage: release-it <increment> [options]',
    '',
    'Use e.g. "release-it minor" directly as shorthand for "release-it --increment=minor".',
    '',
    '-c -- config           Path to local configuration options [default: ".release.json"]',
    '-d --dry-run           Do not touch or write anything, but show the commands and interactivity',
    '-e --debug             Output exceptions',
    '-f --force             Force tagging with Git',
    '-h --help              Print this help',
    '-i --increment         Incrementing "major", "minor", or "patch" version; or specify version [default: "patch"]',
    '-m --message           Commit message [default: "Release %s"]',
    '-n --non-interactive   No interaction (assume default answers to questions)',
    '-g --githubRelease     Release to GitHub',
    '-p --publish           Publish to npm (only in --non-interactive mode)',
    '-v --version           Print version number',
    '-V --verbose           Verbose output'
].join('\n');

module.exports = {
    version: function() {
        log.log('v' + version);
    },
    help: function() {
        log.log(helpText);

    },
    parse: function(argv) {
        var options = parseArgs(argv, {
            boolean: true,
            alias: {
                c: 'config',
                d: 'dry-run',
                e: 'debug',
                f: 'force',
                g: 'githubRelease',
                h: 'help',
                i: 'increment',
                m: 'message',
                n: 'non-interactive',
                p: 'publish',
                v: 'version',
                V: 'verbose'
            }
        });
        options.increment = options.i = (options._[0] || options.i);
        options.commitMessage = options.message;
        return options;
    }
};
