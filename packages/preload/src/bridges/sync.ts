import {ipcRenderer} from 'electron';

export interface SyncOptions {
  enableMouseSync?: boolean;
  enableKeyboardSync?: boolean;
  enableWheelSync?: boolean;
  enableCdpSync?: boolean;
  mouseMoveThrottleMs?: number;
  mouseMoveThresholdPx?: number;
  wheelThrottleMs?: number;
  cdpSyncIntervalMs?: number;
}

export const SyncBridge = {
  // Window arrangement (legacy)
  arrangeWindows: (args: {
    mainPid: number;
    childPids: number[];
    columns: number;
    size: {width: number; height: number};
    spacing: number;
  }) => {
    return ipcRenderer.invoke('window-arrange', args);
  },

  // Multi-window synchronization
  startSync: (args: {
    masterWindowId: number;
    slaveWindowIds: number[];
    options?: SyncOptions;
  }) => {
    return ipcRenderer.invoke('multi-window-sync-start', args);
  },

  stopSync: () => {
    return ipcRenderer.invoke('multi-window-sync-stop');
  },

  getSyncStatus: () => {
    return ipcRenderer.invoke('multi-window-sync-status');
  },
};
