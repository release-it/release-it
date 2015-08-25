var cliOptions = require('./cli-options'),
    log = require('./log'),
    config = require('./config'),
    tasks = require('./tasks'),
    tracker = require('./tracker');

function cli(options) {
    return execute(cliOptions.parse(options));
}

function execute(cliOptions) {

    var options = config.mergeOptions(cliOptions);

    return tracker.askPermissionAndTrack(options).then(function() {

        if(cliOptions.version) {

            cliOptions.version();
            tracker._track('version');

        } else if(cliOptions.help) {

            cliOptions.help();
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
    cli: cli,
    execute: execute
};
