#!/usr/bin/env node

require('@std/esm');
require('babel-register');

const release = require('../lib/index').default;

release().then(() => process.exit(0), () => process.exit(1));
