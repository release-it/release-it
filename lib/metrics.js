import got from 'got';
import supportsColor from 'supports-color';
import windowSize from 'window-size';
import uuid from 'uuid';
import osName from 'os-name';
import isCi from 'is-ci';
import _ from 'lodash';
import { config } from './config';
import { debug } from './debug';
import pkg from '../package.json';

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

export default action =>
  send(
    Object.assign({}, payload, {
      t: 'event',
      ec: 'session',
      ea: action
    })
  );

export const trackException = err =>
  send(
    Object.assign({}, payload, {
      t: 'exception',
      exd: err.message.split('\n')[0]
    })
  );
