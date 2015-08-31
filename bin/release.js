#!/usr/bin/env node

var release = require('../lib/release'),
    args = [].slice.call(process.argv, 2);

var exitCode = 0,
    isDebug = args.indexOf('--debug') !== -1;

release.cli(args).then(function() {
    process.exit(exitCode);
}).catch(function(err) {
    exitCode = 1;
    if(!isDebug) {
        console.error(error);
    } else {
        throw new Error(err);
    }
});

process.on('exit', function() {
    process.exit(exitCode);
});
