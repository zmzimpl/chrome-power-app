import {execSync} from 'child_process';
import * as os from 'os';
import {createLogger} from '../../../shared/utils/logger';
import {APP_LOGGER_LABEL} from '../constants';

const logger = createLogger(APP_LOGGER_LABEL);

export function getOperatingSystem() {
  const platform = os.platform();

  if (platform === 'win32') {
    return 'Windows';
  } else if (platform === 'darwin') {
    return 'Mac';
  } else if (platform === 'linux') {
    return 'Linux';
  } else {
    return 'Unknown OS';
  }
}

export function getChromePath() {
  const operatingSystem = getOperatingSystem();
  let chromePath;
  switch (operatingSystem) {
    case 'Windows':
      {
        const stdoutBuffer = execSync(
          'reg query "HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\chrome.exe" /ve',
        );
        const stdout = stdoutBuffer.toString();
        const match = stdout.match(/(.:\\.*chrome.exe)/);
        if (match) {
          logger.info(`Chrome path: ${match[1]}`);
          chromePath = match[1];
        } else {
          logger.error('Chrome not found');
        }
      }
      break;
    case 'Mac':
      {
        const stdoutBuffer = execSync(
          'mdfind "kMDItemCFBundleIdentifier == \'com.google.Chrome\'"',
        );
        const stdout = stdoutBuffer.toString();
        const paths = stdout.split('\n').filter(path => path.endsWith('/Google Chrome.app'));
        if (paths.length > 0) {
          logger.info(`Chrome path: ${paths[0]}`);
          chromePath = paths[0];
        } else {
          logger.error('Chrome not found');
        }
      }
      break;
    default:
      break;
  }
  return chromePath;
}
