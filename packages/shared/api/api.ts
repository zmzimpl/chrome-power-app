import axios from 'axios';


const api = axios.create();


api.interceptors.response.use(
  response => {
    return response;
  },
  error => {
    return Promise.reject(error);
  },
);

export default api;
