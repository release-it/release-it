const _ = require('lodash');
const Log = require('./log');
const deprecated = require('../conf/deprecated.json');

const log = new Log();
let counter = 0;

const deprecate = (config, dep, keys = []) => {
  _.forOwn(dep, (value, deprecatedKey) => {
    const deprecatedPath = [...keys, deprecatedKey];
    if (_.isObject(value)) {
      deprecate(config, value, deprecatedPath);
    } else {
      if (_.has(config, deprecatedPath)) {
        const currentPath = _.get(deprecated, deprecatedPath);
        counter++ || log.warn(`Deprecated configuration options found. Please migrate before the next major release.`);
        log.warn(
          `The "${deprecatedPath.join('.')}" option is deprecated.${
            currentPath ? ` Please use "${currentPath}" instead.` : ''
          }`
        );
        _.set(config, currentPath, _.get(config, deprecatedPath));
      }
    }
  });
  return config;
};

module.exports = config => deprecate(config, deprecated);
