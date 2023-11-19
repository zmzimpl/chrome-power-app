import knex from 'knex';

import {DB_CONFIG} from '../constants';
import {WindowDB} from './window';
import {resetWindowStatus} from '../fingerprint';
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
  await db.migrate.latest();
  // await deleteAll();
  await initWindowStatus();
};

export {db, initializeDatabase};
