import axios from 'axios';
import type {DB, SafeAny} from '../../../shared/types/db';
import type {AxiosError} from 'axios';
import {createLogger, getRequestProxy} from '../../../shared/utils/index';
import api from '../../../shared/api/api';
import {API_LOGGER_LABEL} from '../constants';
import {HttpProxyAgent} from 'http-proxy-agent';
import {HttpsProxyAgent} from 'https-proxy-agent';
import {SocksProxyAgent} from 'socks-proxy-agent';
import {ProxyDB} from '../db/proxy';
import {PIN_URL} from '../../../shared/constants';
import {db} from '../db';
import {getOrigin} from '../server';
import {bridgeMessageToUI} from '../mainWindow';
import type {AxiosProxyConfig} from 'axios';

const logger = createLogger(API_LOGGER_LABEL);

const getRealIP = async (proxy: DB.Proxy) => {
  const requestProxy = getRequestProxy(proxy.proxy!, proxy.proxy_type!);

  const makeRequest = async (url: string, proxy: AxiosProxyConfig | undefined) => {
    try {
      const {data} = await axios.get(url, {
        proxy: proxy,
        timeout: 5_000,
      });
      return url.includes('ip-api.com') ? data.query : data.ip;
    } catch (error) {
      throw new Error(`Failed to fetch IP from ${url}: ${error}`);
    }
  };

  try {
    return await Promise.race([
      makeRequest('http://ip-api.com/json/?fields=61439', requestProxy),
      makeRequest('https://api64.ipify.org?format=json', requestProxy),
    ]);
  } catch (error) {
    bridgeMessageToUI({
      type: 'error',
      text: `获取真实IP失败: ${(error as {message: string}).message}`,
    });
    logger.error(`| Prepare | getRealIP | error: ${(error as {message: string}).message}`);
    return '';
  }
};

export const getProxyInfo = async (proxy: DB.Proxy) => {
  let attempts = 0;
  const maxAttempts = 3;
  const realIP = await getRealIP(proxy);
  const params = {
    ip: realIP,
  };
  while (attempts < maxAttempts) {
    try {
      const res = await api.get(getOrigin() + `/ip/${proxy.ip_checker || 'ip2location'}`, {
        params: params,
      });
      return res.data;
    } catch (error) {
      attempts++;
      logger.error(error);
      if (attempts === maxAttempts) {
        logger.error(
          '| Prepare | getProxyInfo | error:',
          `get ip info failed after ${maxAttempts} attempts`,
          (error as unknown as SafeAny)?.message,
        );
      }
    }
  }
};

export function getAgent(proxy: DB.Proxy) {
  let agent;
  let agentField: string = 'httpsAgent';
  if (proxy.proxy) {
    const [host, port, username, password] = proxy.proxy.split(':');
    switch (proxy.proxy_type?.toLowerCase()) {
      case 'socks5':
        agent = new SocksProxyAgent(
          username ? `socks://${username}:${password}@${host}:${port}` : `socks://${host}:${port}`,
        );
        agentField = 'httpsAgent';
        break;
      case 'http':
        agent = new HttpProxyAgent(
          username ? `http://${username}:${password}@${host}:${port}` : `http://${host}:${port}`,
        );
        agentField = 'httpAgent';
        break;
      case 'https':
        agent = new HttpsProxyAgent(
          username ? `http://${username}:${password}@${host}:${port}` : `http://${host}:${port}`,
        );
        agentField = 'httpsAgent';
        break;

      default:
        break;
    }
  }
  return {
    agent,
    agentField,
  };
}

export async function testProxy(proxy: DB.Proxy) {
  const result: {
    ipInfo?: {[key: string]: string};
    connectivity: {name: string; elapsedTime: number; status: string; reason?: string}[];
  } = {connectivity: []};

  const requestProxy = getRequestProxy(proxy.proxy!, proxy.proxy_type!);
  try {
    const ipInfo = await getProxyInfo(proxy);
    result.ipInfo = ipInfo || {};
  } catch (error) {
    logger.error(error);
  }
  for (const pin of PIN_URL) {
    const startTime = Date.now();
    try {
      const response = await axios.get(pin.url, {
        proxy: proxy.proxy ? requestProxy : undefined,
        timeout: 5_000,
      });
      const endTime = Date.now();
      const elapsedTime = endTime - startTime; // Calculate the time taken for the request
      if (response.status === 200) {
        result.connectivity.push({
          name: pin.n,
          status: 'connected',
          elapsedTime: elapsedTime,
        });
      } else {
        result.connectivity.push({
          name: pin.n,
          status: 'failed',
          reason: `Status code: ${response.status}`,
          elapsedTime: elapsedTime,
        });
      }
    } catch (error) {
      logger.error(`ping ${pin.name} failed:`, (error as AxiosError)?.message);
      const endTime = Date.now();
      const elapsedTime = endTime - startTime;
      result.connectivity.push({
        name: pin.n,
        status: 'failed',
        reason: (error as AxiosError)?.message,
        elapsedTime: elapsedTime,
      });
    }
  }
  if (proxy.id) {
    await ProxyDB.update(proxy.id, {
      check_result: JSON.stringify(result),
      checked_at: db.fn.now(),
    } as DB.Group);
  }

  return result;
}
