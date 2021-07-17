import { EOL } from 'os';
import got from 'got';
import { v4 as uuidv4 } from 'uuid';
import osName from 'os-name';
import isCi from 'is-ci';
import _debug from 'debug';
import pkg from '../package.json';

const debug = _debug('release-it:metrics');

const noop = Promise.resolve();

const cast = value => (value ? 1 : 0);

const cid = uuidv4();

const payload = config => ({
  v: 1,
  tid: 'UA-108828841-1',
  cid,
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

export default Metrics;
