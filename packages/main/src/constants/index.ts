import {getDbPath} from '../utils/get-db-path';
import {app} from 'electron';
import {join} from 'path';

export const DB_CONFIG = {
  client: 'sqlite3',
  connection: {
    filename: getDbPath(),
  },
  migrations: {
    directory: import.meta.env.MODE === 'development' ? 'migrations' : 'resources/app/migrations',
  },
  useNullAsDefault: true,
};

export const APP_LOGGER_LABEL = 'App';
export const SERVICE_LOGGER_LABEL = 'Service';
export const WINDOW_LOGGER_LABEL = 'Window';
export const PROXY_LOGGER_LABEL = 'Proxy';
export const API_LOGGER_LABEL = 'Api';
export const MAIN_LOGGER_LABEL = 'Main';

export const CONFIG_FILE_PATH = join(app.getPath('userData'), 'chrome-power-config.json');
export const LOGS_PATH = join(app.getPath('userData'), 'logs');
