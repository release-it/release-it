const pkg = require('../package.json');
const Log = require('./log');

const log = new Log();

const helpText = `Release It! v${pkg.version}

  Usage: release-it <increment> [options]

  Use e.g. "release-it minor" directly as shorthand for "release-it --increment=minor".

  -c --config            Path to local configuration options [default: ".release-it.json"]
  -d --dry-run           Do not touch or write anything, but show the commands
  -h --help              Print this help
  -i --increment         Increment "major", "minor", "patch", or "pre*" version; or specify version [default: "patch"]
     --ci                No questions asked. Activated automatically in CI environments.
  -n --non-interactive   Same as --ci
  -v --version           Print version number
  -V --verbose           Verbose output`;

module.exports.version = () => log.log(`v${pkg.version}`);

module.exports.help = () => log.log(helpText);
