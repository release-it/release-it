const { EOL } = require('os');
const _ = require('lodash');

_.templateSettings.interpolate = /\${([\s\S]+?)}/g;

const format = (template = '', context = {}) => {
  template = template.replace(/%s/g, '${version}');
  return _.template(template)(context);
};

const truncateLines = (input, maxLines = 10, surplusText = null) => {
  const lines = input.split(EOL);
  const surplus = lines.length - maxLines;
  const output = lines.slice(0, maxLines).join(EOL);
  return surplus > 0 ? (surplusText ? `${output}${surplusText}` : `${output}${EOL}...and ${surplus} more`) : output;
};

module.exports = {
  format,
  truncateLines
};
