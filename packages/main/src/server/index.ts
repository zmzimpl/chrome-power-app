import type {Express} from 'express';
import {type Server} from 'http';
import {WindowDB} from '../db/window';
import {getProxyInfo, testProxy} from '../fingerprint/prepare';
import {ProxyDB} from '../db/proxy';
import type {DB} from '../../../shared/types/db';
const express = require('express');
const cors = require('cors');

const app: Express = express();
let port: number = 49156; // 初始端口

app.use(cors());

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

app.get('/info', async (req, res) => {
  const {windowId} = req.query;
  if (!windowId) {
    res.send({success: false, message: 'windowId is required.', windowData: {}, ipInfo: {}});
    return;
  }
  let windowData: DB.Window = {};
  let ipInfo = {};

  try {
    windowData = await WindowDB.getById(Number(windowId));
    let proxyData: DB.Proxy = {};
    if (windowData.proxy_id) {
      proxyData = await ProxyDB.getById(windowData.proxy_id);
    }
    // get proxy info
    ipInfo = await getProxyInfo(proxyData);
  } catch (error) {
    console.error(error);
  }
  //   // test proxy
  //   const result = await testProxy(proxyData);
  res.send({windowData, ipInfo});
});

app.get('/ping', async (req, res) => {
  const {windowId} = req.query;
  let windowData: DB.Window = {};
  let pings: {
    connectivity: {name: string; elapsedTime: number; status: string; reason?: string}[];
  } = {connectivity: []};

  try {
    windowData = await WindowDB.getById(Number(windowId));
    let proxyData: DB.Proxy = {};
    if (windowData.proxy_id) {
      proxyData = await ProxyDB.getById(windowData.proxy_id);
      pings = await testProxy(proxyData);
    } else {
      pings = await testProxy(proxyData);
    }
  } catch (error) {
    console.error(error);
  }
  //   // test proxy
  //   const result = await testProxy(proxyData);
  res.send({
    pings: pings.connectivity,
  });
});

export const getPort = () => port;

// ... 其他的 Express 配置和路由 ...
