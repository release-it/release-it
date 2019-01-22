const { EOL } = require('os');
const _ = require('lodash');

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

const logPreview = (log, type, text, suffix) => {
  if (text) {
    log.info(`${EOL}${_.upperFirst(type)}:${EOL}${truncateLines(text)}${suffix || ''}`);
  } else {
    log.log();
    log.warn(`Empty ${_.lowerCase(type)}${suffix || ''}`);
  }
};

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

const rejectAfter = ms =>
  wait(ms).then(() => {
    throw new Error(`Timed out after ${ms}ms.`);
  });

module.exports = {
  format,
  truncateLines,
  logPreview,
  rejectAfter
};
