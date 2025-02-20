import {ipcMain} from 'electron';
import type {DB} from '../../../shared/types/db';
import {ExtensionDB} from '../db/extension';
import {copyFileSync, mkdirSync, existsSync, readFileSync, unlinkSync, rmdirSync} from 'fs';
import extract from 'extract-zip';
import {join} from 'path';
import {getSettings} from '../utils/get-settings';
import {db} from '../db';
import {readdir, rename} from 'fs/promises';

export const initExtensionService = () => {
  ipcMain.handle('extension-create', async (_, extension: DB.Extension) => {
    return await ExtensionDB.createExtension({
      ...extension,
      updated_at: db.fn.now() as unknown as string,
    });
  });

  ipcMain.handle('extension-get-all', async () => {
    return await ExtensionDB.getAllExtensions();
  });

  ipcMain.handle(
    'extension-apply-to-windows',
    async (_, extensionId: number, windowIds: number[]) => {
      return await ExtensionDB.insertExtensionWindows(extensionId, windowIds);
    },
  );

  ipcMain.handle('extension-get-windows', async (_, extensionId: number) => {
    return await ExtensionDB.getExtensionWindows(extensionId);
  });

  ipcMain.handle(
    'delete-extension-windows',
    async (_, extensionId: number, windowIds: number[]) => {
      return await ExtensionDB.deleteExtensionWindows(extensionId, windowIds);
    },
  );

  ipcMain.handle('extension-delete', async (_, extensionId: number) => {
    return await ExtensionDB.deleteExtension(extensionId);
  });

  ipcMain.handle(
    'extension-update',
    async (_, extensionId: number, extension: Partial<DB.Extension>) => {
      return await ExtensionDB.updateExtension(extensionId, extension);
    },
  );

  // 添加处理上传文件的方法
  ipcMain.handle(
    'extension-upload-package',
    async (_, filePath: string, existingExtensionId?: number) => {
      try {
        const settings = getSettings();
        // 获取应用数据目录
        const extensionsPath = join(settings.profileCachePath, 'extensions');

        // 确保扩展目录存在
        if (!existsSync(extensionsPath)) {
          mkdirSync(extensionsPath);
        }

        // 为每个扩展创建唯一目录
        const extensionId = existingExtensionId || Date.now();
        const extensionDir = join(extensionsPath, extensionId.toString());
        if (!existsSync(extensionDir)) {
          mkdirSync(extensionDir);
        }

        // 创建临时解压目录
        const tempExtractDir = join(extensionDir, 'temp');
        if (existsSync(tempExtractDir)) {
          const {rm} = require('fs/promises');
          await rm(tempExtractDir, {recursive: true, force: true});
        }
        mkdirSync(tempExtractDir);

        // 复制zip文件到扩展目录
        const destZipPath = join(extensionDir, 'extension.zip');
        copyFileSync(filePath, destZipPath);

        // 先解压到临时目录
        await extract(destZipPath, {dir: tempExtractDir});

        // 现在可以安全地读取 manifest.json 文件
        const manifestPath = join(tempExtractDir, 'manifest.json');
        const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

        // 使用读取到的版本号创建最终目录
        const versionDir = join(extensionDir, manifest.version);

        // 如果版本目录已存在，先删除它
        if (existsSync(versionDir)) {
          const {rm} = require('fs/promises');
          await rm(versionDir, {recursive: true, force: true});
        }

        // 创建新的版本目录
        mkdirSync(versionDir);

        // 将临时目录中的文件移动到版本目录
        const files = await readdir(tempExtractDir);
        for (const file of files) {
          await rename(join(tempExtractDir, file), join(versionDir, file));
        }

        // 清理临时文件
        unlinkSync(destZipPath);
        rmdirSync(tempExtractDir);

        return {
          success: true,
          path: versionDir,
          version: manifest.version,
          extensionId,
        };
      } catch (error) {
        console.error('Failed to process extension package:', error);
        return {
          success: false,
          error: (error as Error).message,
        };
      }
    },
  );

  ipcMain.handle('extension-sync-windows', async (_, extensionId: number, windowIds: number[]) => {
    try {
      // 获取当前扩展已关联的所有窗口
      const currentWindows = await ExtensionDB.getExtensionWindows(extensionId);
      const currentWindowIds = currentWindows.map(w => w.window_id);

      // 需要删除的窗口关联
      const toDelete = currentWindowIds.filter(id => !windowIds.includes(id));
      if (toDelete.length > 0) {
        await ExtensionDB.deleteExtensionWindows(extensionId, toDelete);
      }

      // 需要新增的窗口关联
      const toAdd = windowIds.filter(id => !currentWindowIds.includes(id));
      if (toAdd.length > 0) {
        await ExtensionDB.insertExtensionWindows(extensionId, toAdd);
      }

      return {
        success: true,
        message: '同步成功',
      };
    } catch (error) {
      return {
        success: false,
        message: '同步失败',
      };
    }
  });
};
