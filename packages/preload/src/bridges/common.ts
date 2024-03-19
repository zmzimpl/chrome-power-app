import {ipcRenderer} from 'electron';
import type {SettingOptions} from '../../../shared/types/common';

export const CommonBridge = {
  async download(path: string) {
    const result = await ipcRenderer.invoke('common-download', path);
    return result;
  },
  async choosePath(type: 'openFile' | 'openDirectory') {
    const result = await ipcRenderer.invoke('common-choose-path', type);
    return result;
  },
  async share(key: string, value?: unknown) {
    const result = await ipcRenderer.invoke('data-share', key, value);
    return result;
  },
  async getSettings() {
    const result = await ipcRenderer.invoke('common-fetch-settings');
    return result;
  },
  async saveSettings(settings: SettingOptions) {
    const result = await ipcRenderer.invoke('common-save-settings', settings);
    return result;
  },
  async getLogs(logModule: 'Main' | 'Windows' | 'Proxy' | 'Services' | 'Api') {
    const result = await ipcRenderer.invoke('common-fetch-logs', logModule);
    return result;
  },
};
