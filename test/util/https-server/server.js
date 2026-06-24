import { createServer as createHttpServer } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
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
const tlsOptions = {
  key: readFileSync(join(DIRNAME, './server/privkey.pem')),
  cert: readFileSync(join(DIRNAME, './server/fullchain.pem'))
};

const readBody = req =>
  new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });

const getMultipartFilename = (body, contentType = '') => {
  const boundary = /boundary=(.+)$/.exec(contentType)?.[1];
  if (!boundary) return null;

  const text = body.toString('binary');
  const match = new RegExp(`filename="([^"]+)"[\\s\\S]*?\\r\\n\\r\\n([\\s\\S]*?)\\r\\n--${boundary}`).exec(text);
  return match?.[1] ?? null;
};

/**
 * Basic HTTP(S) server to use for the Gitlab tests.
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
  /**
   * @param {{ protocol?: 'http' | 'https' }} [options]
   */
  constructor({ protocol = 'https' } = {}) {
    this.protocol = protocol;
    const handler = (req, res) => this._requestHandler(req, res);
    this.server =
      protocol === 'http' ? createHttpServer(handler) : createHttpsServer(tlsOptions, handler);
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
        this.debug(`Server listening on ${this.protocol}://${address.address}:${address.port}`);
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
   * @returns {Promise<void>}
   */
  async _requestHandler(req, res) {
    const { url, method } = req;

    if (url === '/api/v4/user') {
      this._json(res, { id: '1234', username: 'release_bot' });
      return;
    }

    if (url === '/api/v4/forbidden-json') {
      this._json(res, { error: 'Forbidden' }, 403);
      return;
    }

    if (url === '/api/v4/forbidden-text') {
      this._text(res, 'Internal Server Error', 500);
      return;
    }

    if (url?.startsWith('/api/v4/projects') && url.endsWith('/members/all/1234')) {
      this._json(res, { access_level: 50 });
      return;
    }

    if (method === 'POST' && url === '/api/v4/projects/user%2Frepo/uploads') {
      const body = await readBody(req);
      const filename = getMultipartFilename(body, req.headers['content-type'] || '') || 'upload.bin';
      this._json(res, {
        alt: filename,
        url: `/uploads/7e8bec1fe27cc46a4bc6a91b9e82a07c/${filename}`,
        full_path: `/-/project/1234/uploads/7e8bec1fe27cc46a4bc6a91b9e82a07c/${filename}`
      });
      return;
    }

    if (method === 'PUT' && url === '/api/v4/projects/user%2Frepo/packages/generic/release-it/2.0.1/file-v2.0.1.txt') {
      const body = await readBody(req);
      if (!body.length) {
        this._json(res, { message: 'Upload failed' }, 400);
        return;
      }

      this._json(res, { message: '201 Created' });
      return;
    }

    if (method === 'PUT' && url === '/api/v4/projects/user%2Frepo/packages/generic/release-it/2.0.1/invalid-upload.txt') {
      this._json(res, { message: 'Upload failed' });
      return;
    }

    if (method === 'POST' && url === '/api/v4/projects/user%2Frepo/releases') {
      const body = await readBody(req);
      const payload = JSON.parse(body.toString());
      this._json(res, {
        _links: {
          self: `https://localhost:3000/user/repo/-/releases/${payload.tag_name}`
        }
      });
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
   * @param {number} [status]
   */
  _json(res, payload, status = 200) {
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(payload));
  }

  /**
   * @private
   *
   * Sends out a text response
   *
   * @param {RequestResponse} res
   * @param {string} message
   * @param {number} [status]
   */
  _text(res, message, status = 200) {
    res.writeHead(status, { 'content-type': 'text/plain' });
    res.end(message);
  }
}

function getDirname() {
  if (import.meta.dirname) return import.meta.dirname;

  return fileURLToPath(new URL('.', import.meta.url));
}
