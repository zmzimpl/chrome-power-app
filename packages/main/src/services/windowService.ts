import {ipcMain} from 'electron';
import {readFileSync} from 'fs';
import {txtToJSON} from '../utils/txtToJson';
import * as XLSX from 'xlsx';
import type {IWindowTemplate} from '../types/windowTemplate';
import type {DB, SafeAny} from '../../../shared/types/db';
import {WindowDB} from '../db/window';
import {closeFingerprintWindow, openFingerprintWindow} from '../fingerprint/index';
import {createLogger} from '../../../shared/utils/logger';
import {SERVICE_LOGGER_LABEL} from '../constants';

const logger = createLogger(SERVICE_LOGGER_LABEL);
export const initWindowService = () => {
  logger.info('init window service...');
  ipcMain.handle('window-import', async (_, filePath: string) => {
    let fileData: IWindowTemplate[] = [];
    if (filePath.endsWith('xlsx') || filePath.endsWith('xls')) {
      const workbook = XLSX.readFile(filePath);
      const sheet_name_list = workbook.SheetNames;
      fileData = XLSX.utils.sheet_to_json(workbook.Sheets[sheet_name_list[0]]);
      fileData.forEach(item => {
        if (typeof item.cookie === 'string' && item.cookie === 'Cookie过长，超出Excel单元格上限') {
          item.cookie = JSON.stringify([]);
        }
      });
    } else {
      const fileContent = readFileSync(filePath, 'utf-8');
      const data = txtToJSON(fileContent);
      fileData = data.filter(f => f.id);
    }
    const result = await WindowDB.externalImport(fileData);
    return result;
  });

  ipcMain.handle('window-create', async (_, window: DB.Window, fingerprint: SafeAny) => {
    logger.info('try to create window', JSON.stringify(window));
    return await WindowDB.create(window, fingerprint);
  });

  ipcMain.handle('window-update', async (_, id: number, window: DB.Window) => {
    return await WindowDB.update(id!, window);
  });

  ipcMain.handle('window-delete', async (_, id: number) => {
    return await WindowDB.remove(id);
  });
  ipcMain.handle('window-batchClear', async (_, ids: number[]) => {
    return await WindowDB.batchClear(ids);
  });
  ipcMain.handle('window-batchDelete', async (_, ids: number[]) => {
    return await WindowDB.batchRemove(ids);
  });

  ipcMain.handle('window-getAll', async () => {
    return await WindowDB.all();
  });

  ipcMain.handle('window-getById', async (_, id: number) => {
    return await WindowDB.getById(id);
  });

  ipcMain.handle('window-open', async (_, id: number) => {
    return await openFingerprintWindow(id);
  });
  ipcMain.handle('window-close', async (_, id: number) => {
    return await closeFingerprintWindow(id, true);
  });
};
