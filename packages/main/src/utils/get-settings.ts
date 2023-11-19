import {app} from 'electron';
import {existsSync, readFileSync, writeFileSync} from 'fs';
import {join} from 'path';
import type {SettingOptions} from '../../../shared/types/common';

export const getSettings = (): SettingOptions => {
  const userDataPath = app.getPath('userData');
  const configFilePath = join(userDataPath, 'chrome-power-config.json');
  let settings = {profileCachePath: `${userDataPath}\\cache`};

  try {
    if (existsSync(configFilePath)) {
      const fileContent = readFileSync(configFilePath, 'utf8');
      settings = JSON.parse(fileContent);
    } else {
      writeFileSync(configFilePath, JSON.stringify(settings), 'utf8');
    }
  } catch (error) {
    console.error('Error handling the settings file:', error);
  }
  return settings;
};
