var path = require('path'),
    fs = require('fs'),
    log = require('./log'),
    config = require('./config'),
    globcp = require('./globcp'),
    shell = require('shelljs'),
    when = require('when'),
    sequence = require('when/sequence'),
    fn = require('when/node'),
    noop = when.resolve(true);

var forcedCmdRe = /^!/;

function run(command, commandArgs) {

    var shellCommand = getShellCommand(command.replace(forcedCmdRe, '')),
        cmd = [].slice.call(arguments).join(' '),
        normalizedCmd = cmd.replace(forcedCmdRe, ''),
        args = [].slice.call(arguments, 1),
        silentState = shell.config.silent;

    shell.config.silent = !config.isVerbose();

    log.execution(normalizedCmd);

    if (normalizedCmd === cmd && config.isDryRun()) {
        return noop;
    }

    return when.promise(function(resolve, reject) {

        if(shellCommand === 'exec') {

            shell.exec(normalizedCmd, function(code, output) {
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

function mkCleanDir(dir) {
    return sequence([
        run.bind(null, 'rm', '-rf', dir),
        run.bind(null, 'mkdir', '-p', dir)
    ]);
}

function build(command) {
    return command ? run(command) : noop.then(function() {
        log.verbose('No build command was provided.');
    });
}

function npmPublish(path, tag) {
    var publishPath = path || '.';
    return run('npm', 'publish', publishPath, '--tag', tag);
}

function copy(files, options, target) {
    log.execution('copy', files, options, target);
    return !config.isDryRun() ? globcp(files, options, target) : noop;
}

function bump(file, version) {
    if(file) {
        log.execution('bump', file, version);
    }
    if (!config.isDryRun() && file !== false) {
        var files = typeof file === 'string' ? [file] : file;
        return when.map(files, function(file) {
            return fn.call(fs.readFile, path.resolve(file)).then(function(data) {
                var pkg = JSON.parse(data.toString());
                pkg.version = version.substr(0, version.length - 2) + "-SNAPSHOT";
                return pkg;
            }, function(err) {
                log.warn('Could not read ' + (err.path || file));
                log.debug(err);
            }).then(function(data) {
                if(data){
                    return fn.call(fs.writeFile, file, JSON.stringify(data, null, 2) + '\n');
                }
            }).catch(function(err) {
                log.warn('Could not bump version in ' + file);
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
    mkCleanDir: mkCleanDir,
    build: build,
    npmPublish: npmPublish,
    copy: copy,
    bump: bump
};
