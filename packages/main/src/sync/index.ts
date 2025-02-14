// import {ipcRenderer} from 'electron';
import type {SafeAny} from '../../../shared/types/db';
const activeWindow = require('active-win');

let windowAddon: unknown;
if (process.env.MODE === 'development') {
  // const isMac = process.platform === 'darwin';
  // windowAddon = require(path.join(
  //   __dirname,
  //   isMac
  //     ? '../src/native-addon/build/Release/window-addon.node'
  //     : '../src/native-addon/build/Release/window-addon.node',
  // ));
} else {
  // windowAddon = require(path.join(
  //   process.resourcesPath,
  //   'app.asar.unpacked',
  //   'node_modules',
  //   'window-addon',
  //   'window-addon.node',
  // ));
}
export const tileWindows = async () => {
  try {
    const tileResult = (windowAddon as unknown as SafeAny)!.tileChromeWindows();
    console.log('tileResult', tileResult);
  } catch (error) {
    console.error(error);
  }
};

export const startGroupControl = async (masterProcessId?: number, slaveProcessIds?: number[]) => {
  let master = masterProcessId;
  let slaves = slaveProcessIds;
  if (!masterProcessId) {
    const windows = await activeWindow.getOpenWindows({
      screenRecordingPermission: true,
    });
    const chromeWindows = windows.filter((f: {title: string}) =>
      f.title.includes('By ChromePower'),
    );
    master = chromeWindows[0].owner.processId;
    slaves = chromeWindows
      .slice(1)
      .map((window: {owner: {processId: number}}) => window.owner.processId);
  }
  console.log('master', master);
  console.log('slaves', slaves);
  try {
    const result = (windowAddon as unknown as SafeAny)!.startGroupControl(master, slaves);
    console.log('result', result);
  } catch (error) {
    console.error(error);
  }
};

// 创建一个函数，用于接收来自原生插件的消息
// function controlActionCallback(action: SafeAny) {
//   console.log('controlActionCallback', action);
//   // 处理 action，比如发送到渲染进程
//   ipcRenderer.send('control-action', action);
// }

// 将函数传递给原生插件
// (windowAddon as unknown as SafeAny)!.setControlActionCallback(controlActionCallback);
