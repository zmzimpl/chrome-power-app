import {ipcMain} from 'electron';
import type {DB} from '../../../shared/types/db';
import {GroupDB} from '../db/group';
import {WindowDB} from '../db/window';
export const initGroupService = () => {
  ipcMain.handle('group-create', async (_, group: DB.Group) => {
    return await GroupDB.create(group);
  });

  ipcMain.handle('group-update', async (_, group: DB.Group) => {
    return await GroupDB.update(group.id!, group);
  });

  ipcMain.handle('group-delete', async (_, id: number) => {
    const windows = await WindowDB.find({group_id: id});
    if (windows.length > 0) {
      return {
        success: false,
        message: 'Group is used by some windows',
      };
    }
    const res = await GroupDB.remove(id);
    return {
      success: true,
      message: 'Group deleted successfully',
      data: res,
    };
  });

  ipcMain.handle('group-getAll', async () => {
    return await GroupDB.all();
  });
  ipcMain.handle('group-getById', async (_, id: number) => {
    return await GroupDB.getById(id);
  });
};
