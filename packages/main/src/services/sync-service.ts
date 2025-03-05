import {app, ipcMain, systemPreferences, shell} from 'electron';
import path from 'path';
import type {SafeAny} from '../../../shared/types/db';
import { createLogger } from '../../../shared/utils/logger';
import { MAIN_LOGGER_LABEL } from '../constants';
import { dialog } from 'electron';
const logger = createLogger(MAIN_LOGGER_LABEL);
let addon: unknown;
if (!app.isPackaged) {
  addon = require(path.join(__dirname, '../src/native-addon/build/Release/', 'window-addon.node'));
} else {
  const addonPath = path.join(
    process.resourcesPath,
    'app.asar.unpacked/node_modules/window-addon',
    'window-addon.node',
  );

  try {
    addon = require(addonPath);
  } catch (error) {
    logger.error('Failed to load addon:', error);
    logger.error('Attempted path:', addonPath);
    logger.error('Process arch:', process.arch);
  }
}

export const initSyncService = () => {
  if (!addon) {
    logger.error('Window addon not loaded properly', process.resourcesPath);
    return;
  }
  
  // 检查辅助功能权限（仅macOS）
  if (process.platform === 'darwin') {
    const hasPermission = systemPreferences.isTrustedAccessibilityClient(false);
    logger.info(`Accessibility permission: ${hasPermission ? 'granted' : 'denied'}`);
    
    if (!hasPermission) {
      // 在应用启动时提示用户授予权限
      logger.warn('应用需要辅助功能权限来排列窗口');
      dialog.showMessageBox({
        type: 'warning',
        title: '需要辅助功能权限',
        message: '请在系统偏好设置中为应用授予辅助功能权限，以启用窗口排列功能。',
        buttons: ['前往设置', '稍后再说'],
        defaultId: 0,
      }).then(({ response }) => {
        if (response === 0) {
          // 打开辅助功能设置
          shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility');
        }
      });
    }
  }
  
  const windowManager = new (addon as SafeAny).WindowManager();

  logger.info('WindowManager initialized');

  ipcMain.handle('window-arrange', async (_, args) => {
    const {mainPid, childPids, columns, size, spacing} = args;
    logger.info('Arranging windows', {mainPid, childPids, columns, size, spacing});
    try {
      if (!windowManager) {
        logger.error('WindowManager not initialized');
        throw new Error('WindowManager not initialized');
      }
      logger.info('arrangeWindows', windowManager.arrangeWindows.toString());
      try {
        windowManager.arrangeWindows(mainPid, childPids, columns, size, spacing);
      } catch (e) {
        logger.error('Native function execution error:', e);
        throw e;
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
