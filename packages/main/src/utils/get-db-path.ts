import {app} from 'electron';
import {join} from 'path';

export function getDbPath() {
  let dbPath;

  try {
    if (app.isPackaged) {
      dbPath = join(app.getPath('userData'), 'db.sqlite3');
    } else {
      dbPath = join(app.getPath('userData'), 'dev-db.sqlite3'); // 您原先的数据库位置
    }
  } catch {
    // 默认的开发数据库位置，或其他你选择的位置
    dbPath = join(__dirname, 'dev-db.sqlite3');
  }

  return dbPath;
}
