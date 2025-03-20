import {join} from 'path';
import pngToIco from 'png-to-ico';
import {existsSync, mkdirSync, writeFileSync, readFileSync, unlinkSync} from 'fs';
import {app} from 'electron';
import {execSync} from 'child_process';
import {createLogger} from '../../../shared/utils/logger';
import {MAIN_LOGGER_LABEL} from '../constants';
import sharp from 'sharp';

const logger = createLogger(MAIN_LOGGER_LABEL);

export async function generateChromeIcon(profileDir: string, tag: string | number): Promise<string> {
    const winChromeIcoPath = join(profileDir, 'Default', 'Google Profile.ico');
    const macChromeIcoPath = join(profileDir, 'Default', 'Google Profile.icns');
    const isMac = process.platform === 'darwin';
    const icoPath = isMac ? macChromeIcoPath : winChromeIcoPath;
  
    try {
      // 确保目标目录存在
      const targetDir = join(profileDir, 'Default');
      if (!existsSync(targetDir)) {
        mkdirSync(targetDir, {recursive: true});
      }
  
      // 临时文件路径
      const tempPngPath = join(targetDir, 'temp_icon.png');
      const outputPngPath = join(targetDir, 'modified_icon.png');
  
      // 直接寻找PNG格式图标
      const pngIconPaths = [
        join(app.isPackaged ? process.resourcesPath : process.cwd(), 'buildResources', 'icon.png'),
        join(app.isPackaged ? process.resourcesPath : process.cwd(), 'assets', 'icon.png'),
        join(app.isPackaged ? process.resourcesPath : process.cwd(), 'resources', 'icon.png'),
      ];
      
      let sourceIconPath = '';
      for (const path of pngIconPaths) {
        if (existsSync(path)) {
          sourceIconPath = path;
          break;
        }
      }
      
      if (!sourceIconPath) {
        logger.error('未找到PNG格式图标，请确保在buildResources或assets目录中有icon.png文件');
        return '';
      }
      
      // 直接复制PNG图标到临时文件
      const pngBuffer = readFileSync(sourceIconPath);
      writeFileSync(tempPngPath, pngBuffer);
      
      // 获取图像信息
      const metadata = await sharp(tempPngPath).metadata();
      const width = metadata.width || 128;
      const height = metadata.height || 128;
      
      // 创建底部标签区域(蓝色背景，占图像底部20%高度)
      const tagHeight = Math.floor(height * 0.25);
      const tagY = height - tagHeight;
      
      // 创建SVG叠加层
      const svgBuffer = Buffer.from(`
        <svg width="${width}" height="${height}">
          <rect x="0" y="${tagY}" width="${width}" height="${tagHeight}" fill="#1677ff" />
          <text
            x="${width / 2}"
            y="${tagY + tagHeight * 0.86}"
            font-family="Arial"
            font-size="${tagHeight}"
            font-weight="bold"
            fill="white"
            text-anchor="middle"
            dominant-baseline="middle"
          >${tag.toString()}</text>
        </svg>
      `);
      
      // 添加SVG叠加层到图像上
      await sharp(tempPngPath)
        .composite([{ input: svgBuffer }])
        .toFile(outputPngPath);
      
      // 第3步: 将PNG转换回平台特定格式
      if (isMac) {
        // macOS: 使用sips将png转换为icns
        execSync(`sips -s format icns "${outputPngPath}" --out "${icoPath}"`);
      } else {
        // Windows: 使用png-to-ico将png转换为ico
        try {
          const pngBuffer = readFileSync(outputPngPath);
          const icoBuffer = await pngToIco([pngBuffer]);
          writeFileSync(icoPath, icoBuffer);
        } catch (err) {
          logger.error(`无法将PNG转换为ICO: ${err}`);
          return '';
        }
      }
      
      // 清理临时文件
      try {
        if (existsSync(tempPngPath)) {
          unlinkSync(tempPngPath);
        }
        if (existsSync(outputPngPath)) {
          unlinkSync(outputPngPath);
        }
      } catch (err) {
        logger.warn(`清理临时文件失败: ${err}`);
      }
  
      logger.info(`成功为${isMac ? 'macOS' : 'Windows'}创建带标签的图标: ${icoPath}`);
      return icoPath;
    } catch (error) {
      logger.error(`生成Chrome图标失败: ${error}`);
      return '';
    }
  }
