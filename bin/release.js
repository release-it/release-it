#!/usr/bin/env node

var release = require('../lib/release'),
    args = [].slice.call(process.argv, 2);

release.cli(args).then(function() {
    process.exit(0);
}, function(error) {
    console.error(error);
    process.exit(1);
});
