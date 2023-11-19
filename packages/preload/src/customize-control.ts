import {ipcRenderer} from 'electron';

export const customizeToolbarControl = {
  close() {
    ipcRenderer.invoke('close');
  },
  minimize() {
    ipcRenderer.invoke('minimize');
  },
  maximize() {
    ipcRenderer.invoke('maximize');
  },
  async isMaximized() {
    const maximized = await ipcRenderer.invoke('isMaximized');
    return maximized;
  },
};
