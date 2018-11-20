const { EOL } = require('os');
const got = require('got');
const supportsColor = require('supports-color');
const windowSize = require('window-size');
const uuid = require('uuid');
const osName = require('os-name');
const isCi = require('is-ci');
const _ = require('lodash');
const { config } = require('./config');
const { debug } = require('./debug');
const pkg = require('../package.json');

const cast = value => (value ? 1 : 0);
const pickDebugProps = response => _.pick(response, ['statusCode', 'statusMessage', 'url']);

const cid = uuid.v4();
const dimensions = windowSize ? windowSize.get() : { width: 0, height: 0 };
const vp = `${dimensions.width}x${dimensions.height}`;
const depths = ['1-bit', '4-bit', '8-bit', '24-bits'];
const sd = depths[supportsColor.level || 0];

const payload = {
  v: 1,
  tid: 'UA-108828841-1',
  cid,
  vp,
  sd,
  cd1: pkg.version,
  cd2: process.version,
  cd3: osName(),
  cd4: cast(config.isInteractive),
  cd5: cast(config.isDryRun),
  cd6: cast(config.isVerbose),
  cd7: cast(config.isDebug),
  cd8: cast(config.options.buildCommand),
  cd9: config.options.preReleaseId,
  cd10: cast(config.options.dist.repo),
  cd11: cast(isCi)
};

const send = payload =>
  got('http://www.google-analytics.com/collect', {
    timeout: 300,
    retries: 0,
    form: true,
    body: payload
  })
    .then(pickDebugProps)
    .then(debug)
    .catch(debug);

module.exports.trackEvent = config.isCollectMetrics
  ? action =>
      send(
        Object.assign({}, payload, {
          t: 'event',
          ec: 'session',
          ea: action
        })
      )
  : () => Promise.resolve();

module.exports.trackException = config.isCollectMetrics
  ? err =>
      config.isCollectMetrics &&
      send(
        Object.assign({}, payload, {
          t: 'exception',
          exd: err.message.split(EOL)[0]
        })
      )
  : () => Promise.resolve();
