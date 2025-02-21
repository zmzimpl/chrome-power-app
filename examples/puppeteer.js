// 不检查 eslint
/* eslint-disable */

import puppeteer from 'puppeteer';

export async function createBrowser() {
  const browser = await puppeteer.connect({
    browserWSEndpoint: 'ws://localhost:9222/devtools/browser/05efd11e-4025-4eb3-ab97-9e335efa354a',
    defaultViewport: null,
  });
  return browser;
}

// 辅助函数：随机等待时间
async function randomWait(min, max) {
  const waitTime = Math.floor(Math.random() * (max - min + 1) + min);
  await new Promise(resolve => setTimeout(resolve, waitTime));
}

// 主要的自动化脚本函数
export async function autoScript(browser) {}

(async () => {
  const browser = await createBrowser();
  await autoScript(browser);
  // await browser.close(); // Only if you want to close the external Chrome instance.
})();
