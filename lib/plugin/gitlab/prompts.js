const { format } = require('../../util');

module.exports = {
  release: {
    type: 'confirm',
    message: context => `Create a release on GitLab (${format(context.gitlab.releaseName, context)})?`,
    default: true
  }
};
