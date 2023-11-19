import {ipcRenderer} from 'electron';

export const SyncBridge = {
  async tileWindows() {
    ipcRenderer.invoke('tile-windows');
  },
};
