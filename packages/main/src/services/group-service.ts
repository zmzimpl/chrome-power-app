import {ipcMain} from 'electron';
import type {DB} from '../../../shared/types/db';
import {GroupDB} from '../db/group';


export const initGroupService = () => {
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
