const { format, truncateLines } = require('../../util');

module.exports = {
  commit: {
    type: 'confirm',
    message: context => `Commit (${truncateLines(format(context.git.commitMessage, context), 1, ' [...]')})?`,
    default: true
  },
  tag: {
    type: 'confirm',
    message: context => `Tag (${format(context.git.tagName, context)})?`,
    default: true
  },
  push: {
    type: 'confirm',
    message: () => 'Push?',
    default: true
  }
};
