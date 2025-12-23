import { createServer } from 'node:https';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { debug } from 'node:util';
import { fileURLToPath } from 'node:url';

/**
 * @typedef {import('http').IncomingMessage} IncomingMessage
 * @typedef {import('http').ServerResponse} ServerResponse
 * @typedef {ServerResponse & { req: IncomingMessage;}} RequestResponse
 * @typedef {import('https').ServerOptions} ServerOptions
 */

const DIRNAME = getDirname();

/** @type {ServerOptions} */
const options = {
  key: readFileSync(join(DIRNAME, './server/privkey.pem')),
  cert: readFileSync(join(DIRNAME, './server/fullchain.pem'))
};

/**
 * Basic https server to use for the Gitlab tests.
 * Uses a self-signed HTTPS certificate to allow testing gitlab release options
 * like `insecure` or `certificateAuthorityFile`.
 *
 * The certicates were generated using the gen-cert.sh script in this folder
 * with the following command:
 *
 *   `./gen-cert.sh localhost`
 *
 */
export class GitlabTestServer {
  constructor() {
    this.server = createServer(options, (req, res) => this._requestHandler(req, res));
    this.debug = debug('release-it:gitlab-test-server');
  }

  /**
   * Starts the server with the given port and host
   *
   * @param {number} [port]
   * @param {string} [host]
   * @returns {Promise<void>}
   */
  run(port = 3000, host) {
    return new Promise((resolve, reject) => {
      if (this.server.listening) {
        resolve();
        return;
      }

      this.server.listen(port, host, () => {
        const address = this.server.address();
        this.debug('Server listening on https://' + address.address + ':' + address.port);
        resolve();
      });

      this.server.on('error', e => {
        if (e.code === 'EADDRINUSE') {
          reject(e);
          return;
        }

        this.debug(e.message);
      });
    });
  }

  /**
   * Closes the server
   *
   * @returns {Promise<void>}
   */
  stop() {
    return new Promise((resolve, reject) => {
      if (!this.server.listening) {
        resolve();
        return;
      }

      this.server.removeAllListeners();

      this.server.close(err => {
        if (err) {
          reject(err);
          return;
        }

        this.debug('Server successfully closed.');
        resolve();
      });
    });
  }

  /**
   * @private
   *
   * Server's main request handler
   *
   * @param {IncomingMessage} req
   * @param {RequestResponse} res
   * @returns {void}
   */
  _requestHandler(req, res) {
    if (req.url === '/api/v4/user') {
      this._json(res, { id: '1234', username: 'release_bot' });
      return;
    }

    if (req.url.startsWith('/api/v4/projects') && req.url.endsWith('/members/all/1234')) {
      this._json(res, { access_level: 50 });
      return;
    }

    this._text(res, 'Ok');
  }

  /**
   * @private
   *
   * Sends out a JSON response
   *
   * @param {RequestResponse} res
   * @param {object} payload
   */
  _json(res, payload) {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(payload));
  }

  /**
   * @private
   *
   * Sends out a text response
   *
   * @param {RequestResponse} res
   * @param {string} message
   */
  _text(res, message) {
    res.writeHead(200, { 'content-type': 'text/plan' });
    res.end(message);
  }
}

function getDirname() {
  if (import.meta.dirname) return import.meta.dirname;

  return fileURLToPath(new URL('.', import.meta.url));
}
