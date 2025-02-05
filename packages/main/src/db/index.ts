import knex from 'knex';
import {app} from 'electron';
import {mkdirSync, existsSync} from 'fs';
import {DB_CONFIG} from '../constants';
import {WindowDB} from './window';
import {resetWindowStatus} from '../fingerprint';
import {join} from 'path';

// import {ProxyDB} from './proxy';
// import {GroupDB} from './group';
// import {TagDB} from './tag';

const db = knex(DB_CONFIG);

const initWindowStatus = async () => {
  const windows = await WindowDB.all();
  for (let index = 0; index < windows.length; index++) {
    const window = windows[index];
    if (window.status === 2) {
      await resetWindowStatus(window.id);
    }
  }
};

// const deleteAll = async () => {
// await TagDB.deleteAll();
// await WindowDB.deleteAll();
// await ProxyDB.deleteAll();
// await GroupDB.deleteAll();
// };

const initializeDatabase = async () => {
  const userDataPath = app.getPath('userData');
  
  // 确保目录存在
  if (!existsSync(userDataPath)) {
    mkdirSync(userDataPath, { recursive: true });
  }

  try {
    // 初始化数据库连接
    await db.raw('SELECT 1');
    
    // 运行迁移
    await db.migrate.latest({
      directory: app.isPackaged 
        ? join(process.resourcesPath, 'app/migrations')
        : './migrations',
    });

    // 初始化窗口状态
    await initWindowStatus();

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization failed:', error);
    throw error;
  }
};

export {db, initializeDatabase};
