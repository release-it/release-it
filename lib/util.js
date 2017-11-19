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
  const lines = input.split('\n');
  const surplus = lines.length - maxLines;
  const output = lines.slice(0, maxLines).join('\n');
  return surplus > 0 ? `${output}\n...and ${surplus} more` : output;
};

module.exports = {
  format,
  template,
  truncateLines
};
