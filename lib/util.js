const { EOL } = require('os');
const util = require('util');
const _ = require('lodash');

_.templateSettings.interpolate = /\${([\s\S]+?)}/g;

const format = (template, ...replacements) => {
  if (!_.includes(template, '%')) {
    return template;
  } else {
    return util.format(template, ...replacements);
  }
};

const template = (input, context) => {
  return _.template(input)(context);
};

const truncateLines = (input, maxLines = 10) => {
  const lines = input.split(EOL);
  const surplus = lines.length - maxLines;
  const output = lines.slice(0, maxLines).join(EOL);
  return surplus > 0 ? `${output}${EOL}...and ${surplus} more` : output;
};

module.exports = {
  format,
  template,
  truncateLines
};
