#!/usr/bin/env node

require('babel-register')({
  only: /release-it\/lib/
});

const release = require('../lib/index').default;

release().then(() => process.exit(0), () => process.exit(1));
