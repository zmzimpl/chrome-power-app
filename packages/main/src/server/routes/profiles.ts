import express from 'express';
import {WindowDB} from '/@/db/window';
import {closeFingerprintWindow, openFingerprintWindow} from '/@/fingerprint';

const router = express.Router();

router.get('', async (req, res) => {
  const windows = await WindowDB.all();
  res.send(windows);
});

router.get('/open', async (req, res) => {
  const windowId = req.query.windowId as unknown as number;
  const window = await WindowDB.getById(windowId);
  const result = await openFingerprintWindow(windowId);

  res.send({
    window,
    browser: result,
  });
});

router.get('/close', async (req, res) => {
  const windowId = req.query.windowId as unknown as number;
  const window = await WindowDB.getById(windowId);
  await closeFingerprintWindow(windowId, true);
  res.send({
    window,
  });
});

export default router;
