var cliOptions = require('./options'),
    log = require('./log'),
    config = require('./config'),
    tasks = require('./tasks'),
    when = require('when'),
    sequence = require('when/sequence');

function cli(options) {
    var opts = cliOptions.parse(options);
    return execute(opts);
}

function execute(options) {

    return when.promise(function(resolve, reject) {

        if (options.version) {

            cliOptions.version();
            resolve();

        } else if (options.help) {

            cliOptions.help();
            resolve();

        } else {

            var opts = config.mergeOptions(options);

            if(opts.force) {
                log.warn('Using --force, I sure hope you know what you are doing.');
            }

            if(opts.debug) {
                require('when/monitor/console');
            }

            log.debugDir(opts);

            sequence([tasks.releaseSrc, tasks.releaseDist]).then(resolve, reject);

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
