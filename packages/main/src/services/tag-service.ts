import {ipcMain} from 'electron';
import type {DB} from '../../../shared/types/db';
import {TagDB} from '../db/tag';
import { WindowDB } from '../db/window';

export const initTagService = () => {
  ipcMain.handle('tag-create', async (_, tag: DB.Tag) => {
    return await TagDB.create(tag);
  });

  ipcMain.handle('tag-update', async (_, tag: DB.Tag) => {
    return await TagDB.update(tag.id!, tag);
  });

  ipcMain.handle('tag-delete', async (_, id: number) => {
    const windows = await WindowDB.all();
    const windowsWithTag = windows.filter(window => window.tags?.includes(id));
    if (windowsWithTag.length > 0) {
      return {
        success: false,
        message: 'Tag is used by some windows',
      };
    }
    const res = await TagDB.remove(id);
    return {
      success: true,
      message: 'Tag deleted successfully',
      data: res,
    };
  });

  ipcMain.handle('tag-getAll', async () => {
    return await TagDB.all();
  });
  ipcMain.handle('tag-getById', async (_, id: number) => {
    return await TagDB.getById(id);
  });
};
