const { log } = require('./log');
const pkg = require('../package.json');

const helpText = `Release It! v${pkg.version}
  
  Usage: release-it <increment> [options]
  
  Use e.g. "release-it minor" directly as shorthand for "release-it --increment=minor".
  
  -c --config            Path to local configuration options [default: ".release-it.json"]
  -d --dry-run           Do not touch or write anything, but show the commands
     --debug             Print debug information
  -f --force             Force (move) tag
  -h --help              Print this help
  -i --increment         Increment "major", "minor", "patch", or "pre*" version; or specify version [default: "patch"]
  -n --non-interactive   No questions asked.
  -v --version           Print version number
  -V --verbose           Verbose output`;

module.exports.version = () => log(`v${pkg.version}`);

module.exports.help = () => log(helpText);
