const { format } = require('../../util');

const message = context =>
  `Create a ${context.isPreRelease ? 'pre-' : ''}release on GitHub (${format(context.github.releaseName, context)})?`;

module.exports = {
  release: {
    type: 'confirm',
    message,
    default: true
  }
};
