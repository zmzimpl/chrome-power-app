import * as http from 'http';
import * as url from 'url';
import {SocksClient} from 'socks';
import {EventEmitter} from 'events';
import {SocksProxyAgent} from 'socks-proxy-agent';
import type * as internal from 'stream';
import type {SocksCommandOption} from 'socks/typings/common/constants';
import {createLogger} from '../../../shared/utils/logger';
import {PROXY_LOGGER_LABEL} from '../constants';

const logger = createLogger(PROXY_LOGGER_LABEL);

interface SocketOptions {
  listenHost: string;
  listenPort: number;
  socksHost: string;
  socksPort: number;
  socksUsername?: string;
  socksPassword?: string;
}

interface SocksProxyOptions {
  ipaddress: string;
  port: number;
  type: 5 | 4;
  userId?: string;
  password?: string;
}

class HttpProxy extends EventEmitter {
  opt: SocketOptions = {
    listenHost: 'localhost',
    listenPort: 12333,
    socksHost: 'localhost',
    socksPort: 1080,
  };
  proxy: SocksProxyOptions = {
    ipaddress: '127.0.0.1',
    port: 7890,
    type: 5,
  };
  private retryCount = 0;
  private maxRetries = 3;

  constructor(options: SocketOptions) {
    super();
    this.opt = {
      ...this.opt,
      ...options,
    };
    this.proxy = {
      ipaddress: this.opt.socksHost,
      port: this.opt.socksPort,
      type: 5,
      userId: this.opt.socksUsername || '',
      password: this.opt.socksPassword || '',
    };
  }

  _request(
    proxy: SocksProxyOptions,
    uReq: http.IncomingMessage,
    uRes: http.ServerResponse<http.IncomingMessage> & {
      req: http.IncomingMessage;
    },
  ) {
    const u = url.parse(uReq.url!);
    const socksAgent = new SocksProxyAgent(
      `socks://${proxy.userId}:${proxy.password}@${proxy.ipaddress}:${proxy.port}`,
    );

    const options = {
      hostname: u.hostname,
      port: u.port || 80,
      path: u.path,
      method: uReq.method || 'get',
      headers: uReq.headers,
      agent: socksAgent,
      timeout: 5000,
    };

    const handleRequest = () => {
      const pReq = http.request(options);
      
      pReq.on('response', pRes => {
        this.retryCount = 0; // 重置重试计数
        pRes.pipe(uRes);
        uRes.writeHead(pRes.statusCode!, pRes.headers);
        this.emit('request:success');
      }).on('error', e => {
        logger.error('Proxy connection error:', {
          error: e.message,
          host: u.hostname,
          port: u.port,
          proxy: `${proxy.ipaddress}:${proxy.port}`,
          url: uReq.url,
        });
        if (this.retryCount < this.maxRetries) {
          this.retryCount++;
          setTimeout(() => handleRequest(), 1000); // 1秒后重试
        } else {
          uRes.writeHead(500);
          uRes.end('Connection error\n');
          this.emit('request:error', e);
        }
      });
      
      uReq.pipe(pReq);
    };
    
    handleRequest();
  }

  _connect(
    proxy: SocksProxyOptions,
    uReq: http.IncomingMessage,
    uSocket: internal.Duplex,
    uHead: Buffer,
  ) {
    const u = url.parse(`http://${uReq.url}`);
    const options = {
      proxy,
      destination: {host: u.hostname!, port: u.port ? +u.port! : 80},
      command: 'connect' as SocksCommandOption,
    };

    if (!uSocket.writable) {
      this.emit('connect:error', new Error('Client socket is not writable'));
      return;
    }

    SocksClient.createConnection(options, (error, pSocket) => {
      if (error) {
        if (uSocket?.writable) {
          uSocket?.write(`HTTP/${uReq.httpVersion} 500 Connection error\r\n\r\n`);
        }
        this.emit('connect:error', error);
        return;
      }

      try {
        if (pSocket?.socket && uSocket?.writable) {
          pSocket.socket.pipe(uSocket);
          uSocket.pipe(pSocket.socket);

          pSocket.socket.on('error', err => {
            this.emit('connect:error', err);
            uSocket.destroy();
          });

          uSocket.on('error', err => {
            this.emit('connect:error', err);
            pSocket.socket.destroy();
          });

          if (uSocket.writable) {
            pSocket.socket.write(uHead);
            uSocket.write(`HTTP/${uReq.httpVersion} 200 Connection established\r\n\r\n`);
          }

          this.emit('connect:success');
          pSocket.socket.resume();
        }
      } catch (err) {
        this.emit('connect:error', err);
        uSocket?.destroy();
        pSocket?.socket?.destroy();
      }
    });
  }

  start() {
    const server = http.createServer();
    server.on('connect', (...args) => this._connect(this.proxy, ...args));
    server.on('request', (...args) => this._request(this.proxy, ...args));
    return server.listen(this.opt.listenPort, this.opt.listenHost);
  }
}

export default function SocksServer(opt: SocketOptions) {
  logger.info(
    `Socks server listen on ${opt.listenHost}:${opt.listenPort}, and forward traffic to ${opt.socksHost}:${opt.socksPort}`,
  );
  const proxy = new HttpProxy(opt);
  return proxy.start();
}
