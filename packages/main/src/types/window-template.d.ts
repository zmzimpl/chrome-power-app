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
  proxy_id?: string;
  ua?: string;
  remark?: string;
  cookie?: string;
  [key: string]: unknown;
}
