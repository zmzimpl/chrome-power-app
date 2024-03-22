import type {IWindowTemplate} from '../types/window-template';

export function txtToJSON(txt: string): IWindowTemplate[] {
  const entries = txt.split('\n\n'); // 根据两个换行符来分割每一块数据
  const jsonOutput = [];
  for (const entry of entries) {
    const lines = entry.split('\n');
    const jsonObject: IWindowTemplate = {
      name: '',
      group: '',
      proxyid: '',
      ua: '',
      remark: '',
      cookie: '',
      proxytype: '',
      proxy: '',
      ip: '',
      ipchecker: '',
    };

    if (lines !== null && lines !== undefined) {
      for (const line of lines) {
        const parts = line.split('=', 2);
        const key = parts[0].trim();
        const value = line.substring(key.length + 1);
        jsonObject[key] = value;
      }
    }

    jsonOutput.push(jsonObject);
  }

  return jsonOutput;
}
