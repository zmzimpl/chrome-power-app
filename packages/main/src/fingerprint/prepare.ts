import axios from 'axios';
import type {DB, SafeAny} from '../../../shared/types/db';
import type {AxiosError} from 'axios';
import {createLogger, getRequestProxy} from '../../../shared/utils/index';
import api from '../../../shared/api/api';
import {PROXY_LOGGER_LABEL} from '../constants';
import {HttpProxyAgent} from 'http-proxy-agent';
import {HttpsProxyAgent} from 'https-proxy-agent';
import {SocksProxyAgent} from 'socks-proxy-agent';
import {ProxyDB} from '../db/proxy';
import {PIN_URL} from '../../../shared/constants';
import {db} from '../db';
import {getOrigin} from '../server';
import {bridgeMessageToUI} from '../mainWindow';
import type {AxiosProxyConfig} from 'axios';
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';

const logger = createLogger(PROXY_LOGGER_LABEL);

export async function createShortcutWithIcon(exePath: string, args: string[], iconPath: string, shortcutPath: string) {
  try {
    const shortcutDir = path.dirname(shortcutPath);
    
    // 确保目录存在
    if (!fs.existsSync(shortcutDir)) {
      fs.mkdirSync(shortcutDir, { recursive: true });
    }
    
    // PowerShell 脚本创建快捷方式
    const escapedArgs = args.map(arg => arg.replace(/"/g, '`"')).join(' ');
    const psScript = `
      $WshShell = New-Object -ComObject WScript.Shell
      $Shortcut = $WshShell.CreateShortcut("${shortcutPath.replace(/\\/g, '\\\\')}")
      $Shortcut.TargetPath = "${exePath.replace(/\\/g, '\\\\')}"
      $Shortcut.Arguments = "${escapedArgs}"
      $Shortcut.IconLocation = "${iconPath.replace(/\\/g, '\\\\')}"
      $Shortcut.WorkingDirectory = "${path.dirname(exePath).replace(/\\/g, '\\\\')}"
      
      # 添加这行来设置快捷方式为管理员权限运行
      $bytes = [System.IO.File]::ReadAllBytes("${shortcutPath.replace(/\\/g, '\\\\')}")
      $bytes[0x15] = $bytes[0x15] -bor 0x20 # 设置管理员权限标志
      [System.IO.File]::WriteAllBytes("${shortcutPath.replace(/\\/g, '\\\\')}", $bytes)
      
      $Shortcut.Save()
      
      # 验证文件是否创建成功
      if (Test-Path "${shortcutPath.replace(/\\/g, '\\\\')}") {
        Write-Output "快捷方式创建成功"
      } else {
        Write-Error "快捷方式创建失败"
        exit 1
      }
    `;
    console.log(psScript);
    // 将脚本写入临时文件以避免命令行长度限制
    const tempScriptPath = path.join(os.tmpdir(), `create_shortcut_${Date.now()}.ps1`);
    fs.writeFileSync(tempScriptPath, psScript);
    
    return new Promise((resolve, reject) => {
      exec(`powershell -ExecutionPolicy Bypass -File "${tempScriptPath}"`, (error, stdout, stderr) => {
        // 清理临时脚本文件
        try { fs.unlinkSync(tempScriptPath); } catch (e) { /* 忽略删除失败 */ }
        
        if (error) {
          logger.error(`创建快捷方式失败: ${stderr}`);
          reject(error);
        } else {
          logger.info(`创建快捷方式成功: ${shortcutPath}`);
          resolve(shortcutPath);
        }
      });
    });
  } catch (error) {
    logger.error(`创建快捷方式异常: ${error}`);
    throw error;
  }
}

const getRealIP = async (proxy: DB.Proxy) => {
  let agent:
    | SocksProxyAgent
    | HttpProxyAgent<`http://${string}:${string}`>
    | HttpsProxyAgent<`http://${string}:${string}`>
    | undefined = undefined;
  let requestProxy: AxiosProxyConfig | undefined = undefined;
  if (proxy.proxy_type?.toLowerCase() === 'socks5') {
    const agentInfo = getAgent(proxy);
    agent = agentInfo.agent;
  } else {
    requestProxy = getRequestProxy(proxy.proxy!, proxy.proxy_type!);
  }

  const makeRequest = async (url: string, proxy: AxiosProxyConfig | undefined) => {
    try {
      const {data} = await axios.get(url, {
        proxy: agent ? false : proxy,
        timeout: 5_000,
        httpAgent: agent,
        httpsAgent: agent,
        validateStatus: function (status) {
          return status >= 200 && status < 300;
        },
        maxRedirects: 5,
      });
      return data.ip;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNRESET') {
          logger.error(`Connection reset by peer: ${url}`);
        } else {
          logger.error(`Network error: ${error.message}`);
        }
      }
      throw error;
    }
  };

  try {
    return await Promise.race([
      makeRequest('https://ipinfo.io/json', requestProxy),
      makeRequest('https://api.ipify.org?format=json', requestProxy),
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
        timeout: 2000,
      });
      return res.data;
    } catch (error) {
      attempts++;
      logger.error('| Prepare | getProxyInfo | error:', error);
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

  let agent:
    | SocksProxyAgent
    | HttpProxyAgent<`http://${string}:${string}`>
    | HttpsProxyAgent<`http://${string}:${string}`>
    | undefined = undefined;
  let requestProxy: AxiosProxyConfig | undefined = undefined;
  if (proxy.proxy_type?.toLowerCase() === 'socks5') {
    const agentInfo = getAgent(proxy);
    agent = agentInfo.agent;
  } else {
    requestProxy = getRequestProxy(proxy.proxy!, proxy.proxy_type!);
  }
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
        proxy:
          proxy.proxy && proxy.proxy_type?.toLocaleLowerCase() !== 'socks5'
            ? requestProxy
            : undefined,
        timeout: 5_000,
        httpAgent: agent,
        httpsAgent: agent,
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
      const endTime = Date.now();
      const elapsedTime = endTime - startTime;
      if (pin.n === 'X' && (error as AxiosError)?.response?.status === 400) {
        result.connectivity.push({
          name: pin.n,
          status: 'connected',
          elapsedTime: elapsedTime,
        });
      } else {
        logger.error(`ping ${pin.name} failed:`, (error as AxiosError)?.message);
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
      ip: result?.ipInfo?.ip,
      ip_country: result?.ipInfo?.country,
      check_result: JSON.stringify(result),
      checked_at: db.fn.now(),
    } as DB.Group);
  }

  return result;
}
