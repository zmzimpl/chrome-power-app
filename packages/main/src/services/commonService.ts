import {app, BrowserWindow, ipcMain, dialog, shell} from 'electron';
import {createLogger} from '../../../shared/utils/logger';
import {dataStore} from '../../../shared/utils/dataStore';
import {SERVICE_LOGGER_LABEL} from '../constants';
import {join} from 'path';
import {copyFileSync, writeFileSync, readFileSync, readdir} from 'fs';
import type {DataStore, SettingOptions} from '../../../shared/types/common';
import {getSettings} from '../utils/get-settings';

const logger = createLogger(SERVICE_LOGGER_LABEL);

export const initCommonService = () => {
  logger.info('init common service...');
  ipcMain.handle('common-download', async (_, filePath: string) => {
    const win = BrowserWindow.getAllWindows()[0];
    const defaultPath = join(app.getPath('downloads'), 'template.xlsx');

    const {filePath: savePath} = await dialog.showSaveDialog(win, {
      title: 'Save Template',
      defaultPath: defaultPath,
      buttonLabel: 'Save',
    });

    if (savePath) {
      copyFileSync(join(__dirname, '../..', filePath), savePath);

      // 打开文件管理器并选择该文件
      shell.showItemInFolder(savePath);

      return savePath;
    } else {
      return null;
    }
  });

  ipcMain.handle('common-fetch-settings', async () => {
    const settings = getSettings();

    return settings;
  });

  ipcMain.handle(
    'common-fetch-logs',
    async (_, module: 'Main' | 'Windows' | 'Proxy' | 'Services' | 'Api' = 'Main') => {
      if (import.meta.env.DEV) {
        return [];
      }
      // read directory and get all folders
      const logFiles = await new Promise<string[]>((resolve, reject) => {
        readdir(`logs/${module}`, (err, files) => {
          if (err) {
            reject(err);
          } else {
            resolve(files);
          }
        });
      });
      // read latest 10 files content
      return logFiles.slice(-10).map(file => {
        const logFile = `logs/${module}/${file}`;
        const content = readFileSync(logFile, 'utf8');
        const formatContent = content
          .split('\n')
          .map(line => {
            const regex = /-\s*(info|warn|error):/;
            let logLevel = 'info';
            const match = line.match(regex);
            if (match) {
              logLevel = match[1];
            }
            return {
              message: line,
              level: logLevel,
            };
          })
          .filter(line => line.message);
        return {
          name: file,
          content: formatContent,
        };
      });
    },
  );

  ipcMain.handle('common-save-settings', async (_, values: SettingOptions) => {
    const userDataPath = app.getPath('userData');
    const configFilePath = join(userDataPath, 'chrome-power-config.json');

    try {
      writeFileSync(configFilePath, JSON.stringify(values), 'utf8');
    } catch (error) {
      console.error('Error writing to the settings file:', error);
    }

    return {};
  });

  ipcMain.handle('common-choose-path', async () => {
    // const win = BrowserWindow.getAllWindows()[0];

    const path = await dialog.showOpenDialog({properties: ['openDirectory']});

    return path.filePaths[0];
  });

  ipcMain.handle('data-share', async (_, key: keyof DataStore, value: unknown) => {
    if (value === undefined) {
      // 如果没有提供 value，那么视为获取数据的请求
      return dataStore && dataStore.get(key);
    } else {
      // 如果提供了 value，那么视为设置数据的请求
      dataStore.set(key, value);
      return true; // 表明数据已成功设置
    }
  });
};
