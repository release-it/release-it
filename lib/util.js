var util = require('util'),
    semver = require('semver');

var releaseTypes = ['premajor', 'major', 'preminor', 'minor', 'prepatch', 'patch', 'prerelease', 'pre'];

function isValidVersion(value) {
    return semver.valid(value);
}

function increment(version, increment, identifier) {
    increment = increment || 'patch';
    if (releaseTypes.indexOf(increment) === -1) {
        return increment;
    } else {
        return semver.inc(version, increment, identifier);
    }
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
