const semver = require('semver');
const _ = require('lodash');
const { run } = require('./shell');
const { warn } = require('./log');
const { config } = require('./config');

const getPackageUrl = packageName => {
  return 'https://www.npmjs.com/package/' + packageName;
}

const getTag = () => {
  const tag = _.get(config, 'cliArguments.npm.tag');
  if (tag) return tag;
  const preReleaseComponents = semver.prerelease(config.getOption('version'));
  return _.get(preReleaseComponents, 0, config.getOption('npm.tag'));
};

const publish = (options, pkgName, otpPrompt) => {
  const { publishPath, tag, access, otp } = options;
  const isScopedPkg = pkgName.startsWith('@');
  const accessArg = isScopedPkg && access ? `--access ${access}` : '';
  const otpArg = otp ? `--otp ${otp}` : '';
  const dryRunArg = config.isDryRun ? '--dry-run' : '';
  return run(`npm publish ${publishPath} --tag ${tag} ${accessArg} ${otpArg} ${dryRunArg}`, {
    isReadOnly: true,
    verbose: config.isVerbose || config.isDryRun
  }).catch(err => {
    if (/one-time pass/.test(err)) {
      if (otp != null) {
        warn('The provided OTP is incorrect or has expired.');
      }
      if (otpPrompt) {
        return otpPrompt(otp => publish(Object.assign(options, { otp }), pkgName, otpPrompt));
      }
    }
    throw err;
  });
};

module.exports = {
  getTag,
  publish,
  getPackageUrl
};
