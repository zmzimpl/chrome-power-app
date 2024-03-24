import {ipcMain} from 'electron';
import {createLogger} from '../../../shared/utils/logger';
import {SERVICE_LOGGER_LABEL} from '../constants';
import {startGroupControl, tileWindows} from '../sync';

const logger = createLogger(SERVICE_LOGGER_LABEL);

export const initSyncService = () => {

  ipcMain.handle('tile-windows', async () => {
    tileWindows();
  });

  ipcMain.handle(
    'start-group-control',
    async (_, masterProcessId: number, slaveProcessIds: number[]) => {
      logger.info('start-group-control', masterProcessId, slaveProcessIds);
      startGroupControl(masterProcessId, slaveProcessIds);
    },
  );
};
