#!/usr/bin/env node

var updater = require('update-notifier');
var pkg = require('../package.json');

require('babel-register')({
  ignore: false,
  only: /release-it\/lib/
});

const release = require('../lib/index').default;

updater({ pkg: pkg }).notify();
release().then(() => process.exit(0), () => process.exit(1));
