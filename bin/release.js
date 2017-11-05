#!/usr/bin/env node

const release = require('../lib/release'),
  pkg = require('../package.json'),
  updater = require('update-notifier'),
  args = [].slice.call(process.argv, 2),
  isDebug = args.indexOf('--debug') !== -1;

var exitCode = 0;

updater({ pkg: pkg}).notify();

release.cli(args).then(function() {
  process.exit(exitCode);
}).catch(function(err) {
  exitCode = 1;
  if(!isDebug) {
    console.error(err);
  } else {
    throw err;
  }
});

process.on('exit', function() {
  process.exit(exitCode);
});

process.on('unhandledRejection', function(err){
  if(isDebug && err instanceof Error) {
    console.error(err);
  }
});
