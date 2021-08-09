import { format, truncateLines } from '../../util.js';

export default {
  commit: {
    type: 'confirm',
    message: context => `Commit (${truncateLines(format(context.git.commitMessage, context), 1, ' [...]')})?`,
    default: true
  },
  tag: {
    type: 'confirm',
    message: context => `Tag (${format(context.tagName, context)})?`,
    default: true
  },
  push: {
    type: 'confirm',
    message: () => 'Push?',
    default: true
  }
};
