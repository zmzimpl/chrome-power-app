import axios from 'axios';
import type {DB} from '../../../shared/types/db';
import type {AxiosError} from 'axios';
import {createLogger} from '../../../shared/utils/logger';
import api from '../../../shared/api/api';
import {API_LOGGER_LABEL} from '../constants';
import {HttpProxyAgent} from 'http-proxy-agent';
import {HttpsProxyAgent} from 'https-proxy-agent';
import {SocksProxyAgent} from 'socks-proxy-agent';
import {ProxyDB} from '../db/proxy';
import {PIN_URL} from '../../../shared/constants';
import {db} from '../db';

const logger = createLogger(API_LOGGER_LABEL);

export const getProxyInfo = async (ip: string, gateway: 'ip2location' | 'geoip') => {
  try {
    const res = await api.get('/power-api/ip', {
      params: {
        gateway: gateway,
        ip: ip,
      },
    });
    return res.data;
  } catch (error) {
    logger.error(error);
  }
};

export async function testProxy(proxy: DB.Proxy) {
  const result: {
    ipInfo?: {[key: string]: string};
    connectivity: {name: string; elapsedTime: number; status: string; reason?: string}[];
  } = {connectivity: []};
  try {
    const ipInfo = await getProxyInfo(proxy.ip!, proxy.ip_checker || 'ip2location');
    result.ipInfo = ipInfo || {};
  } catch (error) {
    logger.error(error);
  }

  if (proxy.proxy) {
    const [host, port, username, password] = proxy.proxy.split(':');
    for (const pin of PIN_URL) {
      const startTime = Date.now();
      try {
        let agent;
        let agentField: string = 'httpsAgent';
        switch (proxy.proxy_type?.toLowerCase()) {
          case 'socks5':
            agent = new SocksProxyAgent(
              username
                ? `socks://${username}:${password}@${host}:${port}`
                : `socks://${host}:${port}`,
            );
            agentField = 'httpsAgent';
            break;
          case 'http':
            agent = new HttpProxyAgent(
              username
                ? `http://${username}:${password}@${host}:${port}`
                : `http://${host}:${port}`,
            );
            agentField = 'httpAgent';
            break;
          case 'https':
            agent = new HttpsProxyAgent(
              username
                ? `http://${username}:${password}@${host}:${port}`
                : `http://${host}:${port}`,
            );
            agentField = 'httpsAgent';
            break;

          default:
            break;
        }
        const response = await axios.get(pin.url, {
          [agentField]: agent,
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
  }
  if (proxy.id) {
    await ProxyDB.update(proxy.id, {
      check_result: JSON.stringify(result),
      checked_at: db.fn.now(),
    } as DB.Group);
  }

  return result;
}
