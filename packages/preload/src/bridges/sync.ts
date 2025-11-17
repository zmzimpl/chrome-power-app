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

export interface MonitorInfo {
  x: number;
  y: number;
  width: number;
  height: number;
  isPrimary: boolean;
  index: number;
}

export const SyncBridge = {
  // Window arrangement (legacy)
  arrangeWindows: (args: {
    mainPid: number;
    childPids: number[];
    columns: number;
    size: {width: number; height: number};
    spacing: number;
    monitorIndex?: number;
  }) => {
    return ipcRenderer.invoke('window-arrange', args);
  },

  // Get available monitors
  getMonitors: (): Promise<{success: boolean; monitors: MonitorInfo[]; error?: string}> => {
    return ipcRenderer.invoke('window-get-monitors');
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

  // Listen to global shortcuts from main process
  onShortcutStart: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('sync-shortcut-start', listener);
    // Return cleanup function
    return () => {
      ipcRenderer.removeListener('sync-shortcut-start', listener);
    };
  },

  onShortcutStop: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('sync-shortcut-stop', listener);
    // Return cleanup function
    return () => {
      ipcRenderer.removeListener('sync-shortcut-stop', listener);
    };
  },
};
