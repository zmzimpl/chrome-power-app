import {ipcMain} from 'electron';
import type {DB} from '../../../shared/types/db';
import {TagDB} from '../db/tag';


export const initTagService = () => {
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
