var cli = require('./cli'),
    log = require('./log'),
    config = require('./config'),
    tasks = require('./tasks'),
    when = require('when'),
    noop = when.resolve(true);

    function fromCli(options) {
    return execute(cli.parse(options));
}

function execute(cliArgs) {

    var options = config.mergeOptions(cliArgs);

    if(cliArgs.version) {

        cli.version();

    } else if(cliArgs.help) {

        cli.help();

    } else {

        if(options.force) {
            log.warn('Using --force, I sure hope you know what you are doing.');
        }

        if(options.debug) {
            require('when/monitor/console');
        }

        log.debugDir(options);

        return tasks.run(options).catch(function(error) {

            log.error(error);

            if(options.debug) {
                throw error;
            }

        });
    }

    return noop;
}

module.exports = {
    cli: fromCli,
    execute: execute
};
