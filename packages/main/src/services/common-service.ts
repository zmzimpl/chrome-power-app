import {app, BrowserWindow, ipcMain, dialog, shell} from 'electron';
import {createLogger} from '../../../shared/utils/logger';
import {CONFIG_FILE_PATH, LOGS_PATH, SERVICE_LOGGER_LABEL} from '../constants';
import {join} from 'path';
import {copyFileSync, writeFileSync, readFileSync, readdir, existsSync, mkdirSync} from 'fs';
import type {SettingOptions} from '../../../shared/types/common';
import {getSettings} from '../utils/get-settings';
import {getOrigin} from '../server';
import {
  registerAsDefaultBrowser,
  unregisterAsDefaultBrowser,
  isRegisteredAsDefaultBrowser,
} from './default-browser-service';
import axios from 'axios';
import {writeFile} from 'fs/promises';


const logger = createLogger(SERVICE_LOGGER_LABEL);

export const initCommonService = () => {
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

      // 鎵撳紑鏂囦欢绠＄悊鍣ㄥ苟閫夋嫨璇ユ枃浠?      shell.showItemInFolder(savePath);

      return savePath;
    } else {
      return null;
    }
  });

  // 娣诲姞 IPC 澶勭悊绋嬪簭
  ipcMain.handle('common-save-dialog', async (_, options) => {
    const win = BrowserWindow.getFocusedWindow();
    if (!win) return {canceled: true};
    return dialog.showSaveDialog(win, options);
  });

  ipcMain.handle('common-save-file', async (_, {filePath, buffer}) => {
    await writeFile(filePath, buffer);
  });

  ipcMain.handle('common-fetch-settings', async () => {
    const settings = getSettings();

    return settings;
  });

  ipcMain.handle(
    'common-fetch-logs',
    async (_, module: 'Main' | 'Windows' | 'Proxy' | 'Services' | 'Api' = 'Main') => {
      // if (import.meta.env.DEV) {
      //   return [];
      // }
      const logDir = join(LOGS_PATH, module);
      if (!existsSync(logDir)) {
        mkdirSync(logDir, {recursive: true});
      }
      // read directory and get all folders
      const logFiles = await new Promise<string[]>((resolve, reject) => {
        readdir(logDir, (err, files) => {
          if (err) {
            reject(err);
          } else {
            resolve(files);
          }
        });
      });
      // read latest 10 files content
      return logFiles.slice(-10).map(file => {
        const logFile = join(logDir, file);
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
    if (values.localChromePath === '/Applications/Google Chrome.app') {
      values.localChromePath = values.localChromePath + '/Contents/MacOS/Google Chrome';
    }
    const configFilePath = CONFIG_FILE_PATH;

    try {
      writeFileSync(configFilePath, JSON.stringify(values), 'utf8');
    } catch (error) {
      logger.error('Error writing to the settings file:', error);
    }

    return {};
  });

  ipcMain.handle(
    'common-choose-path',
    async (_, type: 'openFile' | 'openDirectory' = 'openDirectory') => {
      // const win = BrowserWindow.getAllWindows()[0];

      const path = await dialog.showOpenDialog({properties: [type]});

      return path.filePaths[0];
    },
  );

  ipcMain.handle('common-api', async () => {
    const apiUrl = getOrigin();
    const res = await axios.get(`${apiUrl}/status`);
    return {
      url: apiUrl,
      ...(res?.data || {}),
    };
  });

  ipcMain.handle('common-register-default-browser', async () => {
    return await registerAsDefaultBrowser();
  });

  ipcMain.handle('common-unregister-default-browser', async () => {
    return await unregisterAsDefaultBrowser();
  });

  ipcMain.handle('common-is-default-browser', async () => {
    return await isRegisteredAsDefaultBrowser();
  });

  ipcMain.handle('common-open-url-in-window', async (_, windowId: number, url: string) => {
    try {
      // encodeURIComponent ensures OAuth ?& params are not truncated by /json/new
      const encodedUrl = encodeURIComponent(url);
      const resp = await fetch(`http://localhost:${windowId}/json/new?${encodedUrl}`, { method: 'PUT' });
      return { success: resp.ok };
    } catch (e) {
      return { success: false, message: String(e) };
    }
  });
};
