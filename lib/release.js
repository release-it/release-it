var cli = require('./cli'),
    log = require('./log'),
    config = require('./config'),
    tasks = require('./tasks'),
    tracker = require('./tracker');

function fromCli(options) {
    return execute(cli.parse(options));
}

function execute(cliArgs) {

    var options = config.mergeOptions(cliArgs);

    return tracker.askPermissionAndTrack(options).then(function() {

        if(cliArgs.version) {

            cli.version();
            tracker._track('version');

        } else if(cliArgs.help) {

            cli.help();
            tracker._track('help');

        } else {

            if(options.force) {
                log.warn('Using --force, I sure hope you know what you are doing.');
            }

            if(options.debug) {
                require('when/monitor/console');
            }

            log.debugDir(options);

            return tasks.run(options);

        }

    }).catch(function(error) {

        log.error(error);

        if(options.debug) {
            throw error;
        }

    });
}

module.exports = {
    cli: fromCli,
    execute: execute
};
