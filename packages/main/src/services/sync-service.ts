import {app, ipcMain} from 'electron';
import path from 'path';
import type {SafeAny} from '../../../shared/types/db';
import { createLogger } from '../../../shared/utils/logger';
import { MAIN_LOGGER_LABEL } from '../constants';
const logger = createLogger(MAIN_LOGGER_LABEL);
let addon: unknown;
if (!app.isPackaged) {
  addon = require(path.join(__dirname, '../src/native-addon/build/Release/', process.platform === 'darwin' ? process.arch === 'arm64' ? 'window-addon-arm64.node' : 'window-addon-x64.node' : 'window-addon.node'));
} else {
  const addonPath = path.join(
    process.resourcesPath,
    'app.asar.unpacked/node_modules/window-addon',
    process.platform === 'darwin' 
      ? process.arch === 'arm64' 
        ? 'window-addon-arm64.node'
        : 'window-addon-x64.node'
      : 'window-addon.node',
  );

  try {
    addon = require(addonPath);
  } catch (error) {
    console.error('Failed to load addon:', error);
    console.error('Attempted path:', addonPath);
    console.error('Process arch:', process.arch);
  }
}

export const initSyncService = () => {
  if (!addon) {
    logger.error('Window addon not loaded properly');
    return;
  }

  const windowManager = new (addon as SafeAny).WindowManager();

  ipcMain.handle('window-arrange', async (_, args) => {
    const {mainPid, childPids, columns, size, spacing} = args;
    logger.info('Arranging windows', {mainPid, childPids, columns, size, spacing});
    try {
      if (!windowManager) {
        logger.error('WindowManager not initialized');
        throw new Error('WindowManager not initialized');
      }

      const result = windowManager.arrangeWindows(mainPid, childPids, columns, size, spacing);
      if (!result) {
        throw new Error('Window arrangement failed');
      }
      return {success: true};
    } catch (error) {
      logger.error('Window arrangement failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });
};
