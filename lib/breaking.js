const path = require('path');
const { EOL } = require('os');
const detectRepoChangelog = require('detect-repo-changelog');

const conventionalIncrement = async ({ increment }) => {
  if (increment && increment.startsWith('conventional')) {
    const config = {
      plugins: {
        '@release-it/conventional-changelog': {
          preset: increment.split(':')[1]
        }
      }
    };
    const cwd = process.cwd();
    const changelogFile = await detectRepoChangelog(cwd);
    if (changelogFile) {
      config.plugins['@release-it/conventional-changelog'].infile = path.relative(cwd, changelogFile);
    }
    throw new Error(
      `The "${increment}" increment option is no longer valid since release-it v11. ` +
        'Please `npm install -D @release-it/conventional-changelog` and configure the plugin:' +
        EOL +
        EOL +
        JSON.stringify(config, null, 2) +
        EOL +
        EOL +
        'Please refer to https://github.com/release-it/release-it/blob/master/docs/changelog.md#conventional-changelog for more details.'
    );
  }
};

module.exports = async options => {
  await conventionalIncrement(options);
};
