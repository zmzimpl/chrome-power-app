import {getDbPath} from '../utils/getDBPath';

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


