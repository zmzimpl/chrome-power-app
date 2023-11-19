import {join} from 'path';
import {ProxyDB} from '../db/proxy';
import {WindowDB} from '../db/window';
import {getChromePath} from './device';
import {BrowserWindow, app} from 'electron';
import type {Page} from 'puppeteer';
import puppeteer from 'puppeteer';
import {execSync, spawn} from 'child_process';
import * as portscanner from 'portscanner';
import {sleep} from '../utils/sleep';
import SocksServer from '../proxy-server/socksServer';
import type {DB, SafeAny} from '../../../shared/types/db';
import type {IP} from '../../../shared/types/ip';
import {type IncomingMessage, type Server, type ServerResponse} from 'http';
import {createLogger} from '../../../shared/utils/logger';
import {WINDOW_LOGGER_LABEL} from '../constants';
import {db} from '../db';
import {getProxyInfo} from './prepare';
import * as ProxyChain from 'proxy-chain';
import api from '../../../shared/api/api';
import {getSettings} from '../utils/get-settings';

const logger = createLogger(WINDOW_LOGGER_LABEL);

const HOST = '127.0.0.1';

const getPublicIP = async () => {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    return data.ip;
  } catch (error) {
    logger.error('Error fetching public IP:', error);
    return null;
  }
};

const attachFingerprintToPuppeteer = async (page: Page, ipInfo: IP, fingerprint: SafeAny) => {
  const {userAgent, userAgentData} = fingerprint?.fingerprint?.navigator || {};
  page.on('framenavigated', async _msg => {
    const title = await page.title();
    if (!title.includes('By ChromePower')) {
      await page.evaluate(title => {
        document.title = title + ' By ChromePower';
      }, title);
    }
    if (userAgent) {
      await page.setUserAgent(userAgent, userAgentData);
      const client = await page.target().createCDPSession();
      await client.send('Network.setUserAgentOverride', {
        userAgent: userAgent,
      });
    }
    await page.setGeolocation({latitude: ipInfo.ll[0], longitude: ipInfo.ll[1]});
    await page.emulateTimezone(ipInfo.timeZone);
  });
  await page.evaluateOnNewDocument(
    'navigator.mediaDevices.getUserMedia = navigator.webkitGetUserMedia = navigator.mozGetUserMedia = navigator.getUserMedia = webkitRTCPeerConnection = RTCPeerConnection = MediaStreamTrack = undefined;',
  );
  await page.evaluateOnNewDocument(
    (userAgent, userAgentData) => {
      // 将 userAgentData 对象转换为字符串
      const userAgentDataString = JSON.stringify(userAgentData);
      const modifyWorker = (originalWorker: SafeAny) => {
        return function (scriptURL: SafeAny, options: SafeAny) {
          const modifiedCode = `
          // 修改 navigator 对象的代码
          const originalNavigator = navigator;
          navigator = new Proxy(originalNavigator, {
            get(target, prop) {
              if (prop === 'userAgent') {
                return '${userAgent}';
              }
              if (prop === 'platform') {
                return '${userAgentData.platform}';
              }
              if (prop === 'userAgentData') {
                // 将 userAgentDataString 转换回对象
                return JSON.parse('${userAgentDataString}');
              }
              // 可以继续添加其他属性的处理
              return target[prop];
            }
          });
        `;

          const blob = new Blob([modifiedCode + `importScripts('${scriptURL}');`], {
            type: 'application/javascript',
          });
          const blobURL = URL.createObjectURL(blob);
          return new originalWorker(blobURL, options);
        };
      };

      (window.Worker as SafeAny) = modifyWorker(window.Worker);
      (window.SharedWorker as SafeAny) = modifyWorker(window.SharedWorker);

      const originalRegister = navigator.serviceWorker.register;
      navigator.serviceWorker.register = function (scriptURL, options) {
        return originalRegister.call(this, scriptURL, options);
      };
    },
    userAgent,
    userAgentData,
  );
};

async function connectBrowser(port: number, ipInfo: IP, fingerprint: SafeAny) {
  const browserURL = `http://${HOST}:${port}`;
  const browser = await puppeteer.connect({browserURL, defaultViewport: null});
  // const injector = new FingerprintInjector();

  browser.on('targetcreated', async target => {
    const newPage = await target.page();
    if (newPage) {
      await attachFingerprintToPuppeteer(newPage, ipInfo, fingerprint);
    }
  });
  const pages = await browser.pages();
  const page =
    pages.length && pages[0].url() === 'about:blank' ? pages[0] : await browser.newPage();
  try {
    await page.goto('https://ip.me');
  } catch (error) {
    logger.error(error);
  }
}

const fetchWindowFingerprint = async (id: number) => {
  try {
    const {data: fingerprint} = await api.get('/power-api/fingerprints/window', {
      params: {
        windowId: id,
      },
    });
    return fingerprint;
  } catch (error) {
    logger.error(error);
    return undefined;
  }
};

export async function openFingerprintWindow(id: number) {
  const windowData = await WindowDB.getById(id);
  const proxyData = await ProxyDB.getById(windowData.proxy_id);
  const proxyType = proxyData?.proxy_type?.toLowerCase();
  const userDataPath = app.getPath('userData');
  const settings = getSettings();
  let cachePath;
  if (settings.profileCachePath) {
    cachePath = settings.profileCachePath;
  } else {
    cachePath = join(userDataPath, 'cache');
  }
  const win = BrowserWindow.getAllWindows()[0];
  const windowDataDir = `${cachePath}\\${id}_${windowData.profile_id}`;

  const chromePath = getChromePath();

  let ipInfo = {timeZone: '', ip: '', ll: [], country: ''};
  if (windowData.proxy_id && proxyData.ip) {
    ipInfo = await getProxyInfo(proxyData.ip, proxyData.ip_checker || 'ip2location');
  } else {
    const localIp = await getPublicIP();
    ipInfo = await getProxyInfo(localIp, 'ip2location');
  }
  const fingerprint = await fetchWindowFingerprint(id);
  if (chromePath) {
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
      `--remote-debugging-port=${chromePort}`,
      `--user-data-dir=${windowDataDir}`,
    ];

    if (finalProxy) {
      launchParamter.push(`--proxy-server=${finalProxy}`);
    }
    if (ipInfo?.timeZone) {
      launchParamter.push(`--timezone=${ipInfo.timeZone}`);
    }

    const chromeInstance = spawn(chromePath, launchParamter);
    await WindowDB.update(id, {
      status: 2,
      port: chromePort,
      opened_at: db.fn.now() as unknown as string,
    });
    win.webContents.send('window-opened', id);

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
      connectBrowser(chromePort, ipInfo, fingerprint);
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
