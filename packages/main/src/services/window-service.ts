import {ipcMain} from 'electron';
import {readFileSync} from 'fs';
import {txtToJSON} from '../utils/txt-to-json';
import * as XLSX from 'xlsx';
import type {IWindowTemplate} from '../types/window-template';
import type {DB, SafeAny} from '../../../shared/types/db';
import {WindowDB} from '../db/window';
import {closeFingerprintWindow, openFingerprintWindow} from '../fingerprint/index';
import {createLogger} from '../../../shared/utils/logger';
import {SERVICE_LOGGER_LABEL} from '../constants';
import {randomASCII, randomFloat, randomInt} from '../../../shared/utils';
import path from 'path';
import puppeteer from 'puppeteer';
import {presetCookie} from '../puppeteer/helpers';

const logger = createLogger(SERVICE_LOGGER_LABEL);
export const initWindowService = () => {
  logger.info('init window service...');
  ipcMain.handle('window-import', async (_, filePath: string) => {
    let fileData: IWindowTemplate[] = [];
    if (filePath.endsWith('xlsx') || filePath.endsWith('xls')) {
      const workbook = XLSX.readFile(filePath);
      const sheet_name_list = workbook.SheetNames;
      fileData = XLSX.utils.sheet_to_json(workbook.Sheets[sheet_name_list[0]]);
    } else {
      const fileContent = readFileSync(filePath, 'utf-8');
      const data = txtToJSON(fileContent);
      fileData = data.filter(f => f.id);
    }
    console.log(fileData);
    const result = await WindowDB.externalImport(fileData);
    return result;
  });

  ipcMain.handle('window-create', async (_, window: DB.Window, fingerprint: SafeAny) => {
    logger.info(
      'try to create window',
      JSON.stringify({
        ...window,
        cookie: window?.cookie ? `preset ${window.cookie.length} cookies` : [],
      }),
      JSON.stringify(fingerprint),
    );
    console.log(window);
    return await WindowDB.create(window, fingerprint);
  });

  ipcMain.handle('window-update', async (_, id: number, window: DB.Window) => {
    return await WindowDB.update(id!, window);
  });

  ipcMain.handle('window-delete', async (_, id: number) => {
    return await WindowDB.remove(id);
  });
  ipcMain.handle('window-batchClear', async (_, ids: number[]) => {
    return await WindowDB.batchClear(ids);
  });
  ipcMain.handle('window-batchDelete', async (_, ids: number[]) => {
    return await WindowDB.batchRemove(ids);
  });

  ipcMain.handle('window-getAll', async () => {
    return await WindowDB.all();
  });

  ipcMain.handle('window-getOpened', async () => {
    return await WindowDB.getOpenedWindows();
  });

  ipcMain.handle('window-fingerprint', async (_, windowId: number) => {
    if (windowId) {
      const window = await WindowDB.getById(windowId);
      if (window) {
        return {
          ...JSON.parse(window.fingerprint),
        };
      }
    } else {
      return {};
    }
  });

  ipcMain.handle('window-getById', async (_, id: number) => {
    return await WindowDB.getById(id);
  });

  ipcMain.handle('window-open', async (_, id: number) => {
    return await openFingerprintWindow(id);
  });
  ipcMain.handle('window-close', async (_, id: number, force = false) => {
    return await closeFingerprintWindow(id, force);
  });

  ipcMain.handle('window-set-cookie', async (_, id: number) => {
    await WindowDB.update(id, {
      status: 3,
    });
    const {webSocketDebuggerUrl} = await openFingerprintWindow(id, true);

    const browser = await puppeteer.connect({
      browserWSEndpoint: webSocketDebuggerUrl,
      defaultViewport: null,
    });
    await presetCookie(id, browser);
    await browser.close();
    return {
      success: true,
      message: 'Set cookie successfully.',
    };
  });
};

export const randomFingerprint = () => {
  const uaPath = path.join(
    import.meta.env.MODE === 'development' ? 'assets' : 'resources/app/assets',
    'ua.txt',
  );
  const uaFile = readFileSync(uaPath, 'utf-8');
  const uaList = uaFile.split('\n');
  const randomIndex = Math.floor(Math.random() * uaList.length);
  const ua = uaList[randomIndex];
  const result = {
    ua,
    pathStr: randomASCII(),
    webgl: randomFloat(),
    audio: randomInt(),
  };
  return result;
};
