var path = require('path'),
    util = require('./util');

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
        }
    }

    return localOptions;
    
}

function getPackageOptions() {

    var pkg = {};

    try {
        pkg = require(LOCAL_PACKAGE_PATH);
    } catch(error) {
        throw new Error('Cannot find required file: ' + LOCAL_PACKAGE_PATH);
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

var config = {};

config.mergeOptions = function(options) {

    this.options = options;

    var localOptions = getLocalOptions(options.config),
        packageOptions = getPackageOptions(),
        defaultOptions = getDefaultOptions();

    var mergedOptions = util.defaults({}, options, localOptions, packageOptions, defaultOptions);

    mergedOptions.version = util.increment(packageOptions.version, options.increment);

    mergedOptions.verbose = options['non-interactive'] || mergedOptions.verbose;

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

module.exports = Object.create(config);
