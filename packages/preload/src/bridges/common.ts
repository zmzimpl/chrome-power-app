import type {IpcRendererEvent} from 'electron';
import {ipcRenderer} from 'electron';
import type {BridgeMessage, SettingOptions} from '../../../shared/types/common';

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
  async saveDialog(options: Electron.SaveDialogOptions) {
    const result = await ipcRenderer.invoke('common-save-dialog', options);
    return result;
  },
  async saveFile(filePath: string, buffer: Uint8Array | ArrayBuffer) {
    const result = await ipcRenderer.invoke('common-save-file', {filePath, buffer});
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
  async getApi() {
    const result = await ipcRenderer.invoke('common-api');
    return result;
  },

  onMessaged: (callback: (event: IpcRendererEvent, msg: BridgeMessage) => void) =>
    ipcRenderer.on('bridge-msg', callback),

  offMessaged: (callback: (event: IpcRendererEvent, msg: BridgeMessage) => void) =>
    ipcRenderer.off('bridge-msg', callback),
};
