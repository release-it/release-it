const { format } = require('../../util');

const message = context => {
  const { isPreRelease, isUpdate, github } = context;
  const { releaseName } = github;
  const name = format(releaseName, context);
  return `${isUpdate ? 'Update' : 'Create a'} ${isPreRelease ? 'pre-' : ''}release on GitHub (${name})?`;
};

module.exports = {
  release: {
    type: 'confirm',
    message,
    default: true
  }
};
