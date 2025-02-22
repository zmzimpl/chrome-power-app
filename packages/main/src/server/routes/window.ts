import express from 'express';
import type {DB} from '../../../../shared/types/db';
import {WindowDB} from '/@/db/window';
import {ProxyDB} from '/@/db/proxy';
import {getProxyInfo} from '../../fingerprint/prepare';

const router = express.Router();

router.get('/info', async (req, res) => {
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
    ipInfo = await getProxyInfo(proxyData);
  } catch (error) {
    console.error(error);
  }
  res.send({windowData, ipInfo});
});

router.delete('/delete', async (req, res) => {
  const {windowId} = req.query;
  if (!windowId) {
    res.send({success: false, message: 'windowId is required.'});
    return;
  }
  const result = await WindowDB.remove(Number(windowId));
  res.send({
    success: result === 1,
  });
});

router.get('/all', async (_, res) => {
  const windows = await WindowDB.all();
  res.send(windows);
});

router.get('/opened', async (_, res) => {
  const windows = await WindowDB.getOpenedWindows();
  res.send(windows);
});

router.post('/create', async (req, res) => {
  if (!req.body) {
    res.send({success: false, message: 'window is required.'});
    return;
  }
  const window = req.body as DB.Window;
  const result = await WindowDB.create(window);
  res.send(result);
});

router.put('/update', async (req, res) => {
  const {id, window} = req.body;
  if (!id || !window) {
    res.send({success: false, message: 'id and window is required.'});
    return;
  }
  const originalWindow = await WindowDB.getById(id);
  const result = await WindowDB.update(id, {...originalWindow, ...window});
  res.send(result);
});

export default router;
