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

    // 添加未捕获异常处理
    this.on('error', (error) => {
      logger.error('Proxy server error:', error);
    });
    
    process.on('uncaughtException', (error) => {
      if (error instanceof Error && 'code' in error && error.code === 'ECONNRESET') {
        logger.error('Connection reset by peer');
      } else {
        logger.error('Uncaught Exception:', error);
      }
    });
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
      let pReq: http.ClientRequest;
      try {
        pReq = http.request(options);

        // 处理请求错误
        pReq.on('error', e => {
          logger.error('Proxy connection error:', {
            error: e.message,
            host: u.hostname,
            port: u.port,
            proxy: `${proxy.ipaddress}:${proxy.port}`,
            url: uReq.url,
          });
          
          if (this.retryCount < this.maxRetries) {
            this.retryCount++;
            setTimeout(() => handleRequest(), 1000);
          } else {
            try {
              if (!uRes.writableEnded) {
                uRes.writeHead(500);
                uRes.end('Connection error\n');
              }
            } catch (writeError) {
              logger.error('Error writing response:', writeError);
            }
            this.emit('request:error', e);
          }
        });

        // 处理响应
        pReq.on('response', pRes => {
          try {
            this.retryCount = 0;
            
            // 为响应添加错误处理
            pRes.on('error', error => {
              logger.error('Response error:', error);
              try {
                if (!uRes.writableEnded) {
                  uRes.destroy();
                }
              } catch (destroyError) {
                logger.error('Error destroying response:', destroyError);
              }
            });

            if (!uRes.writableEnded) {
              pRes.pipe(uRes);
              uRes.writeHead(pRes.statusCode!, pRes.headers);
            }
            
            this.emit('request:success');
          } catch (error) {
            logger.error('Error handling response:', error);
          }
        });

        // 处理请求端错误
        uReq.on('error', error => {
          logger.error('Client request error:', error);
          try {
            pReq.destroy();
          } catch (destroyError) {
            logger.error('Error destroying proxy request:', destroyError);
          }
        });

        // 处理响应端错误
        uRes.on('error', error => {
          logger.error('Client response error:', error);
          try {
            pReq.destroy();
          } catch (destroyError) {
            logger.error('Error destroying proxy request:', destroyError);
          }
        });

        uReq.pipe(pReq);
      } catch (error) {
        logger.error('Error creating request:', error);
      }
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
        try {
          // 在写入之前检查 socket 是否可写
          if (uSocket?.writable) {
            uSocket?.write(`HTTP/${uReq.httpVersion} 500 Connection error\r\n\r\n`);
          }
        } catch (writeError) {
          // 忽略写入错误，只记录日志
          logger.error('Failed to write error response:', writeError);
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
            try {
              uSocket?.destroy();
            } catch (destroyError) {
              logger.error('Failed to destroy socket:', destroyError);
            }
          });

          uSocket.on('error', err => {
            this.emit('connect:error', err);
            try {
              pSocket.socket?.destroy();
            } catch (destroyError) {
              logger.error('Failed to destroy proxy socket:', destroyError);
            }
          });

          try {
            if (uSocket.writable) {
              pSocket.socket.write(uHead.toString());
              uSocket.write(`HTTP/${uReq.httpVersion} 200 Connection established\r\n\r\n`);
            }
          } catch (writeError) {
            logger.error('Failed to write response:', writeError);
            this.emit('connect:error', writeError);
            return;
          }

          this.emit('connect:success');
          pSocket.socket.resume();
        }
      } catch (err) {
        this.emit('connect:error', err);
        try {
          uSocket?.destroy();
          pSocket?.socket?.destroy();
        } catch (destroyError) {
          logger.error('Failed to cleanup sockets:', destroyError);
        }
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
