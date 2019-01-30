const _ = require('lodash');
const sinon = require('sinon');
const semver = require('semver');
const { parseVersion } = require('../../lib/util');
const Log = require('../../lib/log');
const Config = require('../../lib/config');
const ShellStub = require('../stub/shell');
const Spinner = require('../../lib/spinner');
const Prompt = require('../../lib/prompt');

module.exports.factory = (Definition, { namespace, options = {}, global = {}, container = {} } = {}) => {
  _.defaults(global, { isInteractive: false, isVerbose: false, isDryRun: false, isDebug: false });

  const ns = namespace || Definition.name.toLowerCase();

  container.config = container.config || new Config(Object.assign({ manifest: false, config: false }, options));
  container.log = container.log || sinon.createStubInstance(Log);

  const spinner = container.spinner || sinon.createStubInstance(Spinner);
  spinner.show.callsFake(({ enabled = true, task }) => (enabled ? task() : () => {}));
  container.spinner = spinner;
  container.shell = container.shell || new ShellStub({ global, container });
  container.prompt = container.prompt || new Prompt({ container });

  return new Definition({
    namespace: ns,
    options,
    global,
    container
  });
};

module.exports.runTasks = async plugin => {
  await plugin.init();

  const name = (await plugin.getName()) || '__test__';
  const latestVersion = (await plugin.getLatestVersion()) || '1.0.0';
  plugin.config.setContext({ name, latestVersion });

  const version = (await plugin.getIncrementedVersion({ latestVersion })) || semver.inc(latestVersion, 'patch');
  plugin.config.setContext(parseVersion(version));

  await plugin.beforeBump();
  await plugin.bump(version);
  await plugin.beforeRelease();
  await plugin.release();
  await plugin.afterRelease();

  return {
    name,
    latestVersion,
    version
  };
};
