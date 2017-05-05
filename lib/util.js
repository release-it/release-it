const util = require('util'),
  semver = require('semver'),
  _ = require('lodash');

_.templateSettings.interpolate = /\${([\s\S]+?)}/g;

const releaseTypes = ['premajor', 'major', 'preminor', 'minor', 'prepatch', 'patch', 'prerelease', 'pre'];

function isValidVersion(value) {
  return semver.valid(value);
}

function increment(version, increment, identifier) {
  increment = increment || 'patch';
  if(releaseTypes.indexOf(increment) === -1) {
    return increment;
  } else {
    return semver.inc(version, increment, identifier);
  }
}

function format(template, replacements) { // eslint-disable-line no-unused-vars
  if(template.indexOf('%') === -1) {
    return template;
  } else {
    return util.format.apply(null, arguments);
  }
}

function template(input, context) {
  return _.template(input)(context);
}

module.exports = {
  isValidVersion,
  increment,
  format,
  template
};
