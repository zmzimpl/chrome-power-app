import {BrowserWindow, app, globalShortcut} from 'electron';
import './security-restrictions';
import {restoreOrCreateWindow} from '/@/mainWindow';
import {platform} from 'node:process';
import {db, initializeDatabase} from './db';
import {initServices} from './services';
import {createLogger} from '../../shared/utils/logger';
import {MAIN_LOGGER_LABEL} from './constants';
import './server/index';

const logger = createLogger(MAIN_LOGGER_LABEL);

/**
 * Prevent electron from running multiple instances.
 */
const isSingleInstance = app.requestSingleInstanceLock();
if (!isSingleInstance) {
  app.quit();
  process.exit(0);
}
app.on('second-instance', restoreOrCreateWindow);

/**
 * Disable Hardware Acceleration to save more system resources.
 */
app.disableHardwareAcceleration();

/**
 * Shout down background process if all windows was closed
 */
app.on('window-all-closed', () => {
  if (platform !== 'darwin') {
    app.quit();
  }
});

/**
 * @see https://www.electronjs.org/docs/latest/api/app#event-activate-macos Event: 'activate'.
 */
app.on('activate', restoreOrCreateWindow);

/**
 * Create the application window when the background process is ready.
 */
app
  .whenReady()
  .then(async () => {
    globalShortcut.register('CommandOrControl+Shift+I', () => {
      const win = BrowserWindow.getFocusedWindow();
      if (win) {
        win.webContents.toggleDevTools();
      }
    });
    try {
      await initializeDatabase();
    } catch (error) {
      const errorString = error && typeof error === 'string' ? error : JSON.stringify(error);
      logger.error(`Failed initialize database: ${errorString}`);
    }
    await initServices();
    await restoreOrCreateWindow();
    // if (!import.meta.env.DEV) {
    //   const {result, error, exist} = await extractChromeBin();
    //   if (result) {
    //     if (!exist) {
    //       logger.info('Extracted Chrome-bin.zip');
    //     }
    //   } else {
    //     logger.error('Failed extract Chrome-bin.zip, try to manually extract it', error);
    //   }
    // }
  })
  .catch(e => logger.error('Failed create window:', e));

/**
 * Install Vue.js or any other extension in development mode only.
 * Note: You must install `electron-devtools-installer` manually
 */
// REACT_DEVELOPER_TOOLS doesn't work
// if (import.meta.env.DEV) {
//   app
//     .whenReady()
//     .then(() => import('electron-devtools-installer'))
//     .then(module => {
//       const {default: installExtension, REACT_DEVELOPER_TOOLS} =
//         // @ts-expect-error Hotfix for https://github.com/cawa-93/vite-electron-builder/issues/915
//         typeof module.default === 'function' ? module : (module.default as typeof module);

//       return installExtension(REACT_DEVELOPER_TOOLS, {
//         loadExtensionOptions: {
//           allowFileAccess: true,
//         },
//       });
//     })
//     .catch(e => console.error('Failed install extension:', e));
// }

/**
 * Check for app updates, install it in background and notify user that new version was installed.
 * No reason run this in non-production build.
 * @see https://www.electron.build/auto-update.html#quick-setup-guide
 *
 * Note: It may throw "ENOENT: no such file app-update.yml"
 * if you compile production app without publishing it to distribution server.
 * Like `npm run compile` does. It's ok 😅
 */
if (import.meta.env.PROD) {
  app
    .whenReady()
    .then(() =>
      /**
       * Here we forced to use `require` since electron doesn't fully support dynamic import in asar archives
       * @see https://github.com/electron/electron/issues/38829
       * Potentially it may be fixed by this https://github.com/electron/electron/pull/37535
       */
      require('electron-updater').autoUpdater.checkForUpdatesAndNotify(),
    )
    .catch(e => console.error('Failed check and install updates:', e));
}

app.on('before-quit', async () => {
  await db.destroy();
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
});


process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection:', reason);
});