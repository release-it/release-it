var util = require('util'),
    semver = require('semver');

function isValidVersion(value) {
    return semver.valid(value);
}

function increment(version, increment) {
    increment = increment || 'patch';
    if (['major', 'minor', 'patch'].indexOf(increment) === -1) {
        return increment;
    } else {
        return semver.inc(version, increment);
    }
}

function format(template, replacements) {
    if(template.indexOf('%') === -1) {
        return template;
    } else {
        return util.format(template, replacements);
    }
}

module.exports = {
    isValidVersion: isValidVersion,
    increment: increment,
    format: format
};
