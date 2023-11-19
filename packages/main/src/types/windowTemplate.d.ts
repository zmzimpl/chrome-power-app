// name: row.name,
// group: row.group,
// proxy_id: row.proxyid,
// ua: row.ua,
// remark: row.remark,
// cookie: row.cookie,
// };
// const proxy = {
// proxy_type: row.proxytype,
// proxy: row.proxy,
// ip: row.ip,
// ip_checker: row.ipchecker,
// };
// const group = {
// name: row.group,
export interface IWindowTemplate {
  name?: string;
  group?: string;
  proxyid?: string;
  ua?: string;
  remark?: string;
  cookie?: string;
  proxytype?: string;
  proxy?: string;
  ip?: string;
  ipchecker?: string;
  [key: string]: unknown;
}
