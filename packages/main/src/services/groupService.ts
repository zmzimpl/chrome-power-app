import {ipcMain} from 'electron';
import type {DB} from '../../../shared/types/db';
import {GroupDB} from '../db/group';
import {createLogger} from '../../../shared/utils/logger';
import { SERVICE_LOGGER_LABEL } from '../constants';

const logger = createLogger(SERVICE_LOGGER_LABEL);

export const initGroupService = () => {
  logger.info('init group service...');
  ipcMain.handle('group-create', async (_, group: DB.Group) => {
    return await GroupDB.create(group);
  });

  ipcMain.handle('group-update', async (_, group: DB.Group) => {
    return await GroupDB.update(group.id!, group);
  });

  ipcMain.handle('group-delete', async (_, group: DB.Group) => {
    return await GroupDB.remove(group.id!);
  });

  ipcMain.handle('group-getAll', async () => {
    return await GroupDB.all();
  });
  ipcMain.handle('group-getById', async (_, id: number) => {
    return await GroupDB.getById(id);
  });
};
