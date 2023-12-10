import {ipcMain} from 'electron';
import type {DB} from '../../../shared/types/db';
import {TagDB} from '../db/tag';
import {createLogger} from '../../../shared/utils/logger';
import {SERVICE_LOGGER_LABEL} from '../constants';

const logger = createLogger(SERVICE_LOGGER_LABEL);

export const initTagService = () => {
  logger.info('init tag service...');
  ipcMain.handle('tag-create', async (_, tag: DB.Tag) => {
    return await TagDB.create(tag);
  });

  ipcMain.handle('tag-update', async (_, tag: DB.Tag) => {
    return await TagDB.update(tag.id!, tag);
  });

  ipcMain.handle('tag-delete', async (_, tag: DB.Tag) => {
    return await TagDB.remove(tag.id!);
  });

  ipcMain.handle('tag-getAll', async () => {
    return await TagDB.all();
  });
  ipcMain.handle('tag-getById', async (_, id: number) => {
    return await TagDB.getById(id);
  });
};
