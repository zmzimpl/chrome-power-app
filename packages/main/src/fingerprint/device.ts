import {execSync} from 'child_process';
import * as os from 'os';
import {createLogger} from '../../../shared/utils/logger';
import {APP_LOGGER_LABEL} from '../constants';
import {parse} from 'path';
import {existsSync} from 'fs';

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
          chromePath = match[1];
        } else {
          logger.error('Chrome not found');
        }
      }
      break;
    case 'Mac':
      {
        try {
          // 首先检查默认安装路径
          const defaultPath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
          if (existsSync(defaultPath)) {
            chromePath = defaultPath;
          } else {
            // 使用 mdfind 搜索
            const stdoutBuffer = execSync(
              'mdfind "kMDItemCFBundleIdentifier == \'com.google.Chrome\'"',
            );
            const stdout = stdoutBuffer.toString();
            const paths = stdout
              .split('\n')
              .filter(path => path.endsWith('/Google Chrome.app'))
              .map(path => `${path}/Contents/MacOS/Google Chrome`);

            if (paths.length > 0 && existsSync(paths[0])) {
              chromePath = paths[0];
            } else {
              // 尝试其他可能的路径
              const alternativePaths = [
                '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
                `${process.env.HOME}/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`,
                '/usr/bin/google-chrome',
              ];

              for (const path of alternativePaths) {
                if (existsSync(path)) {
                  chromePath = path;
                  break;
                }
              }
            }
          }

          if (!chromePath) {
            logger.error('Chrome executable not found in any standard location');
          } else {
            // 确保文件有执行权限
            execSync(`chmod +x "${chromePath}"`);
          }
        } catch (error) {
          logger.error(`Error finding Chrome: ${error}`);
        }
      }
      break;
    default:
      break;
  }
  return chromePath;
}

export function getRootDir() {
  const installationPath = process.resourcesPath;
  const parsedPath = parse(installationPath);
  // 获取根目录
  const rootDirectory = parsedPath.root;
  return rootDirectory;
}
