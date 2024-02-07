import type {IpcRendererEvent} from 'electron';
import { ipcRenderer} from 'electron';

export const SyncBridge = {
  async tileWindows() {
    ipcRenderer.invoke('tile-windows');
  },
  async startGroupControl(masterProcessId?: number, slaveProcessIds?: number[]) {
    ipcRenderer.invoke('start-group-control', masterProcessId, slaveProcessIds);
  },
  onGroupControlAction: (callback: (event: IpcRendererEvent, id: number) => void) =>
  ipcRenderer.on('control-action', callback),
};
