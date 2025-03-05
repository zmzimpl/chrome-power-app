// import {ipcRenderer} from 'electron';
import type {SafeAny} from '../../../shared/types/db';

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
export const arrangeWindows = async () => {
  try {
    const arrangeResult = (windowAddon as unknown as SafeAny)!.arrangeWindows();
    console.log('arrangeResult', arrangeResult);
  } catch (error) {
    console.error(error);
  }
};

// export const startGroupControl = async (masterProcessId?: number, slaveProcessIds?: number[]) => {
  
// };

// 创建一个函数，用于接收来自原生插件的消息
// function controlActionCallback(action: SafeAny) {
//   console.log('controlActionCallback', action);
//   // 处理 action，比如发送到渲染进程
//   ipcRenderer.send('control-action', action);
// }

// 将函数传递给原生插件
// (windowAddon as unknown as SafeAny)!.setControlActionCallback(controlActionCallback);
