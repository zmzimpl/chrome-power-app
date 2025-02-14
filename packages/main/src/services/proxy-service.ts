import {ipcMain} from 'electron';
import type {DB} from '../../../shared/types/db';
import {ProxyDB} from '../db/proxy';
import {testProxy} from '../fingerprint/prepare';

export const initProxyService = () => {
  ipcMain.handle('proxy-create', async (_, proxy: DB.Proxy) => {
    return await ProxyDB.create(proxy);
  });

  ipcMain.handle('proxy-import', async (_, proxies: DB.Proxy[]) => {
    return await ProxyDB.importProxies(proxies);
  });

  ipcMain.handle('proxy-update', async (_, id: number, proxy: DB.Proxy) => {
    return await ProxyDB.update(id, proxy);
  });

  ipcMain.handle('proxy-delete', async (_, proxy: DB.Proxy) => {
    return await ProxyDB.remove(proxy.id!);
  });

  ipcMain.handle('proxy-getAll', async () => {
    return await ProxyDB.all();
  });
  ipcMain.handle('proxy-batchDelete', async (_, ids: number[]) => {
    return await ProxyDB.batchDelete(ids);
  });

  ipcMain.handle('proxy-getById', async (_, id: number) => {
    return await ProxyDB.getById(id);
  });

  ipcMain.handle('proxy-test', async (_, testParams: number | DB.Proxy) => {
    if (typeof testParams === 'number') {
      const proxy = await ProxyDB.getById(testParams);
      return await testProxy(proxy);
    } else {
      return await testProxy(testParams);
    }
  });
};
