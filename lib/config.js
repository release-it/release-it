var path = require('path'),
    _ = require('lodash'),
    deprecated = require('./deprecated');

var DEFAULT_CONFIG_PATH = path.resolve(__dirname, '..', 'conf', 'release.json'),
    LOCAL_CONFIG_PATH = path.resolve(process.cwd(), '.release.json'),
    LOCAL_PACKAGE_PATH = path.resolve(process.cwd(), 'package.json');

function getLocalOptions(localConfigFile) {

    var localOptions = {},
        localOptionsPath = localConfigFile ? path.resolve(process.cwd(), localConfigFile) : LOCAL_CONFIG_PATH;

    try {
        localOptions = require(localOptionsPath);
    } catch(error) {
        if(localConfigFile) {
            throw new Error('Cannot find provided local configuration file: ' + localOptionsPath);
        } else if(error.code !== 'MODULE_NOT_FOUND') {
            throw new Error('Could not load configuration file: ' + localOptionsPath + '\n' + error);
        }
    }

    localOptions.pkgFiles = _.isArray(localOptions.pkgFiles) && localOptions.pkgFiles.length === 0 ? false : localOptions.pkgFiles;

    return localOptions;

}

function getNpmPackageOptions() {

    var pkg = {};

    try {
        pkg = require(LOCAL_PACKAGE_PATH);
    } catch(error) {
        pkg = {};
    }

    return {
        version: pkg.version,
        name: pkg.name,
        private: pkg.private
    }

}

function getDefaultOptions() {

    return require(DEFAULT_CONFIG_PATH);

}

var config = {},
    _process = {};

config.mergeOptions = function(options) {

    var localOptions = getLocalOptions(options.config),
        npmPackageOptions = getNpmPackageOptions(),
        defaultOptions = getDefaultOptions();

    var mergedOptions = _.defaultsDeep({}, options, localOptions, {npm: npmPackageOptions}, defaultOptions);

    mergedOptions.name = npmPackageOptions.name || path.basename(process.cwd());

    mergedOptions.verbose = options['non-interactive'] || mergedOptions.verbose;

    mergedOptions = deprecated(mergedOptions);

    return (this.options = mergedOptions);

};

config.getOptions = function() {
    return this.options;
};

config.isDebug = function() {
    return this.options.debug;
};

config.isDryRun = function() {
    return this.options['dry-run'];
};

config.isForce = function() {
    return this.options.force;
};

config.isVerbose = function() {
    return this.options.verbose;
};

config.process = Object.create({
    get: function(key) {
        return _process[key]
    },
    set: function(key, value) {
        _process[key] = value;
    }
});

module.exports = Object.create(config);
