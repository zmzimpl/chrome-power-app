const extract = require('extract-zip');
import {join} from 'path';
import {existsSync, mkdirSync, renameSync, rmdirSync} from 'fs';

export async function extractChromeBin() {
  const resourcesPath = process.resourcesPath;
  const chromeZipPath = join(resourcesPath, 'Chrome-bin.zip');
  const tempExtractPath = join(resourcesPath, 'temp-chrome-bin');

  // 检查临时解压目录是否存在
  if (!existsSync(tempExtractPath)) {
    mkdirSync(tempExtractPath);
  }

  const chromeBinPath = join(resourcesPath, 'Chrome-bin');

  // 检查 Chrome-bin 目录是否存在
  if (!existsSync(chromeBinPath)) {
    try {
      await extract(chromeZipPath, {dir: tempExtractPath});
      console.log('Chrome-bin extraction complete');

      // 检查并调整目录结构
      const extractedDirPath = join(tempExtractPath, 'Chrome-bin');
      if (existsSync(extractedDirPath)) {
        renameSync(extractedDirPath, chromeBinPath);
        rmdirSync(tempExtractPath, {recursive: true});
        return {result: true, exist: false};
      } else {
        return {result: false, error: 'Expected Chrome-bin directory not found inside ZIP'};
      }
    } catch (err) {
      console.error('Error extracting Chrome-bin.zip:', err);
      return {result: false, error: err};
    }
  } else {
    console.log('Chrome-bin already exists');
    return {result: true, exist: true};
  }
}
