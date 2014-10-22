var path = require('path'),
    fs = require('fs'),
    log = require('./log'),
    config = require('./config'),
    globcp = require('./globcp'),
    shell = require('shelljs'),
    when = require('when'),
    fn = require('when/node/function'),
    noop = when.resolve(true);

function run(command, commandArgs) {

    var shellCommand = getShellCommand(command),
        cmd = [].slice.call(arguments).join(' '),
        args = [].slice.call(arguments, 1),
        silentState = shell.config.silent;

    shell.config.silent = !config.isVerbose();

    log.execution(cmd);

    if (config.isDryRun()) {
        return noop;
    }

    return when.promise(function(resolve, reject) {

        if(shellCommand === 'exec') {

            shell.exec(cmd, function(code, output) {
                if (code === 0) {
                    resolve({
                        code: code,
                        output: output
                    });
                } else {
                    reject(output);
                }
            });

        } else if(shellCommand) {

            resolve(shell[shellCommand].apply(shell, args));

        } else {

            resolve(command.apply(null, args));

        }

        shell.config.silent = silentState;

    });

}

function getShellCommand(command) {
    return command && command in shell && typeof shell[command] === 'function' ? command : 'exec';
}

function pushd(path) {
    return run('pushd', path);
}

function popd() {
    return run('popd');
}

function build(command) {
    return command ? run(command) : noop.then(function() {
        log.verbose('No build command was provided.');
    });
}

function npmPublish(path) {
    var options = config.getOptions();
    return run('npm', 'publish', options.publishPath || path || '.');
}

function copy(files, options, target) {
    log.execution('copy', files, options, target);
    return !config.isDryRun() ? globcp(files, options, target) : noop;
}

function bump(file, version) {
    log.execution('bump', file, version);
    if (!config.isDryRun()) {
        var files = typeof file === 'string' ? [file] : file;
        return when.map(files, function(file) {
            return fn.call(fs.readFile, path.resolve(file)).then(function(data) {
                var pkg = JSON.parse(data.toString());
                pkg.version = version;
                return pkg;
            }).then(function(data) {
                return fn.call(fs.writeFile, file, JSON.stringify(data, null, 2) + '\n');
            }).catch(function(err) {
                log.warn('There was a problem bumping the version in ' + file);
                log.debug(err);
            });
        });
    } else {
        return noop;
    }
}

module.exports = {
    run: run,
    pushd: pushd,
    popd: popd,
    build: build,
    npmPublish: npmPublish,
    copy: copy,
    bump: bump
};
