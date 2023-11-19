import {ipcMain} from 'electron';
import {createLogger} from '../../../shared/utils/logger';
import {SERVICE_LOGGER_LABEL} from '../constants';
import {tileWindows} from '../sync';

const logger = createLogger(SERVICE_LOGGER_LABEL);

export const initSyncService = () => {
  logger.info('init sync service...');

  ipcMain.handle('tile-windows', async () => {
    logger.info('tile-windows');
    tileWindows();
  });
};
