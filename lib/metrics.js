const { EOL } = require('os');
const got = require('got');
const supportsColor = require('supports-color');
const windowSize = require('window-size');
const { v4: uuidv4 } = require('uuid');
const osName = require('os-name');
const isCi = require('is-ci');
const debug = require('debug')('release-it:metrics');
const pkg = require('../package.json');

const noop = Promise.resolve();

const cast = value => (value ? 1 : 0);

const cid = uuidv4();
const dimensions = windowSize ? windowSize.get() : { width: 0, height: 0 };
const vp = `${dimensions.width}x${dimensions.height}`;
const depths = ['1-bit', '4-bit', '8-bit', '24-bits'];
const sd = depths[supportsColor.level || 0];

const payload = config => ({
  v: 1,
  tid: 'UA-108828841-1',
  cid,
  vp,
  sd,
  cd1: pkg.version,
  cd2: process.version,
  cd3: osName(),
  cd4: cast(!config.isCI),
  cd5: cast(config.isDryRun),
  cd6: cast(config.isVerbose),
  cd7: cast(config.isDebug),
  cd8: null,
  cd9: config.preReleaseId,
  cd11: cast(isCi),
  cd12: cast(config.git.tag),
  cd13: cast(config.npm.publish),
  cd14: cast(config.github.release),
  cd15: config.increment,
  cd16: cast(config.gitlab.release)
});

class Metrics {
  constructor({ isEnabled = true, request = got } = {}) {
    this.isEnabled = isEnabled;
    this.request = request;
  }
  send(payload) {
    return !this.isEnabled
      ? noop
      : this.request('http://www.google-analytics.com/collect', {
          timeout: 300,
          retries: 0,
          method: 'POST',
          form: payload
        })
          .then(res => {
            const { url, statusCode, statusMessage } = res;
            debug({ url, statusCode, statusMessage, payload: new URLSearchParams(payload).toString() });
          })
          .catch(debug);
  }
  trackEvent(action, config) {
    return this.send(
      Object.assign(config ? payload(config) : {}, {
        t: 'event',
        ec: 'session',
        ea: action
      })
    );
  }
  trackException(err) {
    return this.send({
      t: 'exception',
      exd: err.toString().split(EOL)[0]
    });
  }
}

module.exports = Metrics;
