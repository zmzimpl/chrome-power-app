import type {AxiosProxyConfig} from 'axios';

export const getRequestProxy = (
  proxy: string,
  proxy_type: string,
): AxiosProxyConfig | undefined => {
  if (!proxy) return;
  const [host, port, username, password] = proxy.split(':');
  return {
    protocol: proxy_type.toLocaleLowerCase(),
    host,
    port: +port,
    auth: username
      ? {
          username,
          password,
        }
      : undefined,
  };
};
