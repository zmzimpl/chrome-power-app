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
    // get proxy info
    ipInfo = await getProxyInfo(proxyData);
  } catch (error) {
    console.error(error);
  }
  //   // test proxy
  //   const result = await testProxy(proxyData);
  res.send({windowData, ipInfo});
});

export default router;
