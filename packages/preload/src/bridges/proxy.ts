import {ipcRenderer} from 'electron';
import type {DB} from '../../../shared/types/db';

export const ProxyBridge = {
  async getAll() {
    const result = await ipcRenderer.invoke('proxy-getAll');
    return result;
  },

  async import(proxies: DB.Proxy[]) {
    const result = await ipcRenderer.invoke('proxy-import', proxies);
    return result;
  },

  async update(id: number, proxy: DB.Proxy) {
    const result = await ipcRenderer.invoke('proxy-update', id, proxy);
    return result;
  },

  async batchDelete(ids: number[]) {
    const result = await ipcRenderer.invoke('proxy-batchDelete', ids);
    return result;
  },

  async checkProxy(params: number | DB.Proxy) {
    const result = await ipcRenderer.invoke('proxy-test', params);
    return result;
  },
  // async checkTmpProxy(proxy: DB.Proxy) {
  //   const result = await ipcRenderer.invoke('proxy-test', proxy);
  //   return result;
  // },
};
