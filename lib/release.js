var cliOptions = require('./options'),
    log = require('./log'),
    config = require('./config'),
    tasks = require('./tasks'),
    sequence = require('when/sequence'),
    tracker = require('./tracker');

function cli(options) {
    var opts = cliOptions.parse(options);
    return execute(opts);
}

function execute(options) {

    var opts = config.mergeOptions(options);

    return tracker._askPermission(opts).then(function(resolve, reject) {

        if (options.version) {

            cliOptions.version();
            tracker._track('version');
            resolve();

        } else if (options.help) {

            cliOptions.help();
            tracker._track('help');
            resolve();

        } else {

            if(opts.force) {
                log.warn('Using --force, I sure hope you know what you are doing.');
            }

            if(opts.debug) {
                require('when/monitor/console');
            }

            log.debugDir(opts);

            return sequence([tasks.releaseSrc, tasks.releaseDist]).then(resolve, reject);

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
