/* eslint-disable */
// @ts-nocheck
import {batchCreateWindows, getAllWindows} from './demo/window.js';
import {openProfile} from './demo/profiles.js';

async function main() {
  try {
    // 批量创建窗口
    const windowsToCreate = [{name: '窗口1'}, {name: '窗口2'}, {name: '窗口3'}];

    console.log('开始创建窗口...');
    const createdWindows = await batchCreateWindows(windowsToCreate);
    console.log('创建的窗口:', createdWindows);

    console.log('打开指定 id 的窗口');
    const openResult = await openProfile(247);
    console.log('打开结果:', openResult);

    const windows = await getAllWindows();

    const openedWindows = windows?.filter(f => f.status > 1);
    console.log('已打开的窗口:', openedWindows);

    const connectInfo = await fetch(`http://localhost:${openedWindows[0].port}/json/version`);

    console.log(await connectInfo.json());
  } catch (error) {
    console.error('执行过程中出现错误:', error);
  }
}

main();
