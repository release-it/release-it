import { format, truncateLines, fixArgs } from '../../util.js';

export default {
  commit: {
    type: 'confirm',
    message: context => {
      if (fixArgs(context.git.commitArgs).includes('--amend')) return 'Amend commit?';
      return `Commit (${truncateLines(format(context.git.commitMessage, context), 1, ' [...]')})?`;
    },
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
