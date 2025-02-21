import {ipcRenderer} from 'electron';

export const SyncBridge = {
  arrangeWindows: (args: {
    mainPid: number;
    childPids: number[];
    columns: number;
    size: {width: number; height: number};
  }) => {
    return ipcRenderer.invoke('window-arrange', args);
  },
};
