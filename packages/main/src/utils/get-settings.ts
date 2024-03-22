import {existsSync, readFileSync, writeFileSync} from 'fs';
import {join} from 'path';
import type {SettingOptions} from '../../../shared/types/common';
import {getChromePath, getRootDir} from '../fingerprint/device';

export const getSettings = (): SettingOptions => {
  const configFilePath = join(process.resourcesPath, 'chrome-power-config.json');
  let settings = {
    profileCachePath: join(getRootDir(), 'chromePowerCache'),
    useLocalChrome: true,
    localChromePath: '',
    chromiumBinPath: '',
  };

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
  if (!settings.localChromePath) {
    settings.localChromePath = getChromePath() as string;
  }
  if (settings.useLocalChrome === undefined) {
    settings.useLocalChrome = true;
  }
  if (!settings.chromiumBinPath || settings.chromiumBinPath === 'Chrome-bin\\chrome.exe') {
    if (import.meta.env.DEV) {
      settings.chromiumBinPath = 'Chrome-bin\\chrome.exe';
    } else {
      settings.chromiumBinPath = join(process.resourcesPath, 'Chrome-bin', 'chrome.exe');
    }
  }
  return settings;
};
