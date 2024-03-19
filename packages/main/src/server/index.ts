import type {Express} from 'express';
import {type Server} from 'http';
import express from 'express';
import cors from 'cors';
import IPRouter from './routes/ip';
import WindowRouter from './routes/window';

const app: Express = express();
let port: number = 49156; // 初始端口

app.use(cors());
app.use('/ip', IPRouter);
app.use('/window', WindowRouter);

const server: Server = app
  .listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
    module.exports.port = port;
  })
  .on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      console.log(`Port ${port} is already in use, trying another port...`);
      port++;
      server.close();
      server.listen(port);
    } else {
      console.error(error);
    }
  });

export const getPort = () => port;

export const getOrigin = () => `http://localhost:${port}`;

// ... 其他的 Express 配置和路由 ...
