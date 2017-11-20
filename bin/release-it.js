#!/usr/bin/env node

var updater = require('update-notifier');
var pkg = require('../package.json');

require('babel-register')({
  only: /release-it\/lib/
});

const release = require('../lib');

updater({ pkg: pkg }).notify();
release().then(() => process.exit(0), () => process.exit(1));
