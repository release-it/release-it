import { format } from '../../util.js';

const message = context => {
  const { isPreRelease, github } = context;
  const { releaseName, update } = github;
  const name = format(releaseName, context);
  return `${update ? 'Update' : 'Create a'} ${isPreRelease ? 'pre-' : ''}release on GitHub (${name})?`;
};

export default {
  release: {
    type: 'confirm',
    message,
    default: true
  }
};
