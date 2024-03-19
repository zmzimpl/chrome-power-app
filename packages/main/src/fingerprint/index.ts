import {join} from 'path';
import {ProxyDB} from '../db/proxy';
import {WindowDB} from '../db/window';
// import {getChromePath} from './device';
import {BrowserWindow, app} from 'electron';
import type {Page} from 'puppeteer';
import puppeteer from 'puppeteer';
import {execSync, spawn} from 'child_process';
import * as portscanner from 'portscanner';
import {sleep} from '../utils/sleep';
import SocksServer from '../proxy-server/socksServer';
import type {DB} from '../../../shared/types/db';
import type {IP} from '../../../shared/types/ip';
import {type IncomingMessage, type Server, type ServerResponse} from 'http';
import {createLogger} from '../../../shared/utils/logger';
import {WINDOW_LOGGER_LABEL} from '../constants';
import {db} from '../db';
import {getProxyInfo} from './prepare';
import * as ProxyChain from 'proxy-chain';
import api from '../../../shared/api/api';
import {getSettings} from '../utils/get-settings';
import {getPort} from '../server/index';
import {randomFingerprint} from '../services/windowService';

const logger = createLogger(WINDOW_LOGGER_LABEL);

const HOST = '127.0.0.1';

const settings = getSettings();

// const HomePath = app.getPath('userData');
// console.log(HomePath);

const attachFingerprintToPuppeteer = async (page: Page, ipInfo: IP) => {
  page.on('framenavigated', async _msg => {
    try {
      const title = await page.title();
      if (!title.includes('By ChromePower')) {
        await page.evaluate(title => {
          document.title = title + ' By ChromePower';
        }, title);
      }

      await page.setGeolocation({latitude: ipInfo.ll[0], longitude: ipInfo.ll[1]});
      await page.emulateTimezone(ipInfo.timeZone);
    } catch (error) {
      logger.error(error);
    }
  });
  await page.evaluateOnNewDocument(
    'navigator.mediaDevices.getUserMedia = navigator.webkitGetUserMedia = navigator.mozGetUserMedia = navigator.getUserMedia = webkitRTCPeerConnection = RTCPeerConnection = MediaStreamTrack = undefined;',
  );
};

async function connectBrowser(port: number, ipInfo: IP, windowId: number) {
  const browserURL = `http://${HOST}:${port}`;
  const {data} = await api.get(browserURL + '/json/version');
  if (data.webSocketDebuggerUrl) {
    const browser = await puppeteer.connect({
      browserWSEndpoint: data.webSocketDebuggerUrl,
      defaultViewport: null,
    });

    browser.on('targetcreated', async target => {
      const newPage = await target.page();
      if (newPage) {
        await attachFingerprintToPuppeteer(newPage, ipInfo);
      }
    });
    const pages = await browser.pages();
    const page =
      pages.length &&
      (pages[0].url() === 'about:blank' ||
        !pages[0].url() ||
        pages[0].url() === 'chrome://new-tab-page/')
        ? pages[0]
        : await browser.newPage();
    try {
      await attachFingerprintToPuppeteer(page, ipInfo);
      if (import.meta.env.VITE_START_PAGE_URL) {
        await page.goto(
          `${import.meta.env.VITE_START_PAGE_URL}?windowId=${windowId}&serverPort=${getPort()}`,
        );
      }
    } catch (error) {
      logger.error(error);
    }
  }
}

const getDriverPath = () => {
  if (settings.useLocalChrome) {
    return settings.localChromePath;
  } else {
    return settings.chromiumBinPath;
  }
};

export async function openFingerprintWindow(id: number) {
  const windowData = await WindowDB.getById(id);
  const proxyData = await ProxyDB.getById(windowData.proxy_id);
  const proxyType = proxyData?.proxy_type?.toLowerCase();
  const userDataPath = app.getPath('userData');
  let cachePath;
  if (settings.profileCachePath) {
    cachePath = settings.profileCachePath;
  } else {
    cachePath = join(userDataPath, 'cache');
  }
  const win = BrowserWindow.getAllWindows()[0];
  const windowDataDir = `${cachePath}\\${id}_${windowData.profile_id}`;
  const driverPath = getDriverPath();

  let ipInfo = {timeZone: '', ip: '', ll: [], country: ''};
  if (windowData.proxy_id && proxyData.ip) {
    ipInfo = await getProxyInfo(proxyData);
  } else {
    ipInfo = await getProxyInfo({});
  }
  if (!ipInfo?.ip) {
    logger.error('ipInfo is empty');
    return;
  }
  const fingerprint =
    windowData.fingerprint && windowData.fingerprint !== '{}'
      ? JSON.parse(windowData.fingerprint)
      : randomFingerprint();
  if (!windowData.fingerprint || windowData.fingerprint === '{}') {
    await WindowDB.update(id, {
      ...windowData,
      fingerprint,
    });
  }
  if (driverPath) {
    const chromePort = await portscanner.findAPortNotInUse(9222, 10222);
    let finalProxy;
    let proxyServer: Server<typeof IncomingMessage, typeof ServerResponse> | ProxyChain.Server;
    if (proxyData && proxyType === 'socks5' && proxyData.proxy) {
      const proxyInstance = await createSocksProxy(proxyData);
      finalProxy = proxyInstance.proxyUrl;
      proxyServer = proxyInstance.proxyServer;
    } else if (proxyData && proxyType === 'http' && proxyData.proxy) {
      const proxyInstance = await createHttpProxy(proxyData);
      finalProxy = proxyInstance.proxyUrl;
      proxyServer = proxyInstance.proxyServer;
    }
    const launchParamter = [
      `--extended-parameters=${btoa(JSON.stringify(fingerprint))}`,
      '--force-color-profile=srgb',
      '--no-first-run',
      '--no-default-browser-check',
      '--metrics-recording-only',
      '--disable-background-mode',
      `--remote-debugging-port=${chromePort}`,
      `--user-data-dir=${windowDataDir}`,
      `--user-agent=${fingerprint?.ua}`,
      // below is for debug
      // '--enable-logging',
      // '--v=1',
      // '--enable-blink-features=IdleDetection',
      // '--no-sandbox',
      // '--disable-setuid-sandbox',
      // '--auto-open-devtools-for-tabs',
    ];

    if (finalProxy) {
      launchParamter.push(`--proxy-server=${finalProxy}`);
    }
    if (ipInfo?.timeZone) {
      launchParamter.push(`--timezone=${ipInfo.timeZone}`);
      launchParamter.push(`--tz=${ipInfo.timeZone}`);
    }
    let chromeInstance;
    try {
      chromeInstance = spawn(driverPath, launchParamter);
    } catch (error) {
      logger.error(error);
    }
    if (!chromeInstance) {
      return;
    }
    await sleep(1);
    await WindowDB.update(id, {
      status: 2,
      port: chromePort,
      opened_at: db.fn.now() as unknown as string,
    });
    win.webContents.send('window-opened', id);
    chromeInstance.stdout.on('data', _chunk => {
      // const str = _chunk.toString();
      // console.error('stderr: ', str);
    });
    // 这个地方需要监听 stderr，否则在某些网站会出现卡死的情况
    chromeInstance.stderr.on('data', _chunk => {
      // const str = _chunk.toString();
      // console.error('stderr: ', str);
    });

    chromeInstance.on('close', async () => {
      logger.info(`Chrome process exited at port ${chromePort}, closed time: ${new Date()}`);
      if (proxyType === 'socks5') {
        (proxyServer as Server<typeof IncomingMessage, typeof ServerResponse>)?.close(() => {
          logger.info('Socks5 Proxy server was closed.');
        });
      } else if (proxyType === 'http') {
        (proxyServer as ProxyChain.Server).close(true, () => {
          logger.info('Http Proxy server was closed.');
        });
      }
      closeFingerprintWindow(id);
    });

    await sleep(1);

    try {
      connectBrowser(chromePort, ipInfo, windowData.id);
    } catch (error) {
      logger.error(error);
      execSync(`taskkill /PID ${chromeInstance.pid} /F`);
    }
  } else {
    win.webContents.send('window-opened', null);
  }
}

async function createHttpProxy(proxyData: DB.Proxy) {
  const listenPort = await portscanner.findAPortNotInUse(30000, 40000);
  const [httpHost, httpPort, username, password] = proxyData.proxy!.split(':');

  const oldProxyUrl = `http://${username}:${password}@${httpHost}:${httpPort}`;
  const newProxyUrl = await ProxyChain.anonymizeProxy({
    url: oldProxyUrl,
    port: listenPort,
  });
  const proxyServer = new ProxyChain.Server({
    port: listenPort,
  });

  return {
    proxyServer,
    proxyUrl: newProxyUrl,
  };
}

async function createSocksProxy(proxyData: DB.Proxy) {
  const listenHost = HOST;
  const listenPort = await portscanner.findAPortNotInUse(30000, 40000);
  const [socksHost, socksPort, socksUsername, socksPassword] = proxyData.proxy!.split(':');

  const proxyServer = SocksServer({
    listenHost,
    listenPort,
    socksHost,
    socksPort: +socksPort,
    socksUsername,
    socksPassword,
  });

  proxyServer.on('connect:error', err => {
    logger.error(err);
  });
  proxyServer.on('request:error', err => {
    logger.error(err);
  });

  return {
    proxyServer,
    proxyUrl: `http://${listenHost}:${listenPort}`,
  };
}

export async function resetWindowStatus(id: number) {
  await WindowDB.update(id, {status: 1, port: undefined});
}

export async function closeFingerprintWindow(id: number, force = false) {
  const window = await WindowDB.getById(id);
  const port = window.port;
  const status = window.status;
  if (status === 2) {
    if (force) {
      try {
        const browserURL = `http://${HOST}:${port}`;
        const browser = await puppeteer.connect({browserURL, defaultViewport: null});
        logger.info('close browser', browserURL);
        await browser?.close();
      } catch (error) {
        logger.error(error);
      }
    }
    await WindowDB.update(id, {status: 1, port: undefined});
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
      win.webContents.send('window-closed', id);
    }
  }
}

export default {
  openFingerprintWindow,

  closeFingerprintWindow,
};
