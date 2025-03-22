import {getAllWindows} from './demo/window.js';
import fs from 'fs-extra';
import path from 'path';

async function main() {
  const fromPath = 'E:\\.ADSPOWER_GLOBAL\\cache';
  const toPath = 'E:\\ChromePowerCache\\chrome';
  const adsDirSuffix = '_g1nkg14';
  try {
    const windows = (await getAllWindows()).filter(f => f.group_id);
    console.log(windows[0]);

    for (const window of windows) {
      const fromDir = path.join(fromPath, window.profile_id + adsDirSuffix, 'Default');
      const toDir = path.join(toPath, window.profile_id, 'Default');
      
      // 确保目标目录存在
      await fs.ensureDir(toDir);
      
      // 要复制的文件夹列表
      const foldersToMove = [
        'Extension Rules',
        'Extension Scripts',
        'Extension State',
        'Local Extension Settings',
        'Local Storage',
        'IndexedDB',
      ];
      
      // 要复制的文件列表
      const filesToMove = [
        'Bookmarks',
        'Bookmarks.bak',
        'History',
        'History-journal',
      ];
      
      // 复制文件夹
      for (const folder of foldersToMove) {
        const source = path.join(fromDir, folder);
        const destination = path.join(toDir, folder);
        
        if (await fs.pathExists(source)) {
          console.log(`正在复制文件夹: ${folder} (${window.profile_id})`);
          if (await fs.pathExists(destination)) {
            await fs.remove(destination);
          }
          await fs.copy(source, destination);
        } else {
          console.log(`源文件夹不存在: ${folder} (${window.profile_id})`);
        }
      }
      
      // 复制文件
      for (const file of filesToMove) {
        const source = path.join(fromDir, file);
        const destination = path.join(toDir, file);
        
        if (await fs.pathExists(source)) {
          console.log(`正在复制文件: ${file} (${window.profile_id})`);
          await fs.copy(source, destination, { overwrite: true });
        } else {
          console.log(`源文件不存在: ${file} (${window.profile_id})`);
        }
      }
      
      console.log(`已完成 ${window.profile_id} 的数据迁移`);
    }
    
    console.log('所有配置文件迁移完成');
  } catch (error) {
    console.error('执行过程中出现错误:', error);
  }
}

main();
