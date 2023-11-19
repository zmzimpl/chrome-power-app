import axios from 'axios';
import {dataStore} from '../utils/dataStore';

// 创建 axios 实例
const api = axios.create();

// 请求拦截器
api.interceptors.request.use(
  async config => {
    if (config.url!.startsWith('/power-api')) {
      config.url = config.url!.replace('/power-api', import.meta.env.VITE_APP_API);
    }
    // 从 dataStore 中获取 token
    let access_token = '';
    try {
      if (localStorage?.getItem('chrome_power_session')) {
        access_token = (
          JSON.parse(localStorage.getItem('chrome_power_session')!) as {access_token: string}
        ).access_token;
      }
    } catch (error) {
      access_token = (dataStore.get('session') as {access_token: string})?.access_token;
    }
    if (access_token) {
      config.headers['Authorization'] = `Bearer ${access_token}`; // 将 token 添加到请求头中
    }

    return config;
  },
  error => {
    return Promise.reject(error);
  },
);

// 响应拦截器
api.interceptors.response.use(
  response => {
    // 对响应数据进行处理，比如统一处理响应错误码等
    return response;
  },
  error => {
    // 可以在这里对响应错误进行统一处理，比如 token 过期等
    return Promise.reject(error);
  },
);

export default api;
