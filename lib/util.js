var semver = require('semver');

function extend(obj) {
    [].slice.call(arguments, 1).forEach(function(source) {
        for (var prop in source) {
            obj[prop] = source[prop];
        }
    });
    return obj;
}

function defaults(object, source) {
    var index = 0,
        l = arguments.length;
    while (++index < l) {
        source = arguments[index];
        for(var prop in source) {
            if (typeof object[prop] === 'undefined' || object[prop] === '') {
                object[prop] = source[prop];
            }
        }
    }
    return object;
}

function increment(version, increment) {
    increment = increment || 'patch';
    if (['major', 'minor', 'patch'].indexOf(increment) === -1) {
        return increment;
    } else {
        return semver.inc(version, increment);
    }
}

module.exports = {
    extend: extend,
    defaults: defaults,
    increment: increment
};
