var util = require('util'),
    semver = require('semver'),
    log = require('./log');

var releaseTypes = ['premajor', 'major', 'preminor', 'minor', 'prepatch', 'patch', 'prerelease'];

function isValidVersion(value) {
    return semver.valid(value);
}

function increment(version, increment, identifier) {
    increment = increment || 'patch';
        return semver.inc(version, increment, identifier);
}

function format(template, replacements) {
    if(template.indexOf('%') === -1) {
        return template;
    } else {
        return util.format.apply(null, arguments);
    }
}

module.exports = {
    isValidVersion: isValidVersion,
    increment: increment,
    format: format
};
