import { createServer } from 'node:http';
import { connect } from 'node:net';

/**
 * Basic HTTP CONNECT proxy to use for the Gitlab tests.
 *
 * Tunnels the client to the requested host without looking at the traffic, so tests can
 * exercise the proxy environment variables without reaching the network.
 */
export class ConnectProxy {
  constructor() {
    this.requests = 0;
    this.tunnels = new Set();
    this.server = createServer((req, res) => res.writeHead(405).end());
    this.server.on('connect', (req, clientSocket, head) => this._connect(req, clientSocket, head));
  }

  /**
   * Starts the proxy on a random available port and sets `url` to its address.
   *
   * @returns {Promise<void>}
   */
  run() {
    return new Promise(resolve => {
      this.server.listen(0, '127.0.0.1', () => {
        this.url = `http://127.0.0.1:${this.server.address().port}`;
        resolve();
      });
    });
  }

  /**
   * Closes the proxy and the tunnels it has opened
   *
   * @returns {Promise<void>}
   */
  stop() {
    return new Promise(resolve => {
      if (!this.server.listening) {
        resolve();
        return;
      }

      for (const socket of this.tunnels) {
        socket.destroy();
      }

      this.server.close(resolve);
    });
  }

  /**
   * @private
   *
   * Pipes the client through to the requested host
   *
   * @param {import('http').IncomingMessage} req
   * @param {import('node:net').Socket} clientSocket
   * @param {Buffer} head
   * @returns {void}
   */
  _connect(req, clientSocket, head) {
    this.requests++;

    const [host, port] = req.url.split(':');
    const serverSocket = connect(Number(port), host, () => {
      clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');

      if (head.length > 0) {
        serverSocket.write(head);
      }

      serverSocket.pipe(clientSocket);
      clientSocket.pipe(serverSocket);
    });

    this.tunnels.add(clientSocket);
    clientSocket.on('close', () => {
      this.tunnels.delete(clientSocket);
      serverSocket.destroy();
    });

    serverSocket.on('error', () => clientSocket.destroy());
    clientSocket.on('error', () => serverSocket.destroy());
  }
}
