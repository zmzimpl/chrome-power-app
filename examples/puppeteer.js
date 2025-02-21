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
export async function autoScript(browser) {
  // 如果有需要，可以在上级代码中传入 scriptSteps，也可以在此函数内直接定义 JSON 步骤
  const scriptSteps = [
    {
      "type": "newPage",
      "config": {}
    },
    {
      "type": "gotoUrl",
      "config": {
        "url": "https://x.com/",
        "timeout": 30000,
        "remark": ""
      }
    },
    {
      "type": "waitForSelector",
      "config": {
        "selector": "[role=\"button\"][data-testid=\"like\"]",
        "serial": 1,
        "isShow": "1",
        "timeout": 30000,
        "remark": ""
      }
    },
    {
      "type": "waitTime",
      "config": {
        "timeoutType": "randomInterval",
        "timeout": 2044,
        "timeoutMin": 5678,
        "timeoutMax": 7654,
        "remark": ""
      }
    },
    {
      "type": "scrollPage",
      "config": {
        "distance": 6543,
        "type": "smooth",
        "scrollType": "pixel",
        "position": "middle",
        "remark": ""
      }
    },
    {
      "type": "scrollPage",
      "config": {
        "distance": 0,
        "type": "smooth",
        "scrollType": "position",
        "position": "top",
        "remark": ""
      }
    },
    {
      "type": "passingElement",
      "config": {
        "selector": "[role=\"button\"][data-testid=\"like\"]",
        "selectorType": "selector",
        "element": "",
        "serialType": "fixedValue",
        "serial": 1,
        "serialMin": 1,
        "serialMax": 50,
        "remark": ""
      }
    },
    {
      "type": "waitTime",
      "config": {
        "timeoutType": "randomInterval",
        "timeout": 30000,
        "timeoutMin": 1112,
        "timeoutMax": 1212,
        "remark": ""
      }
    },
    {
      "type": "click",
      "config": {
        "selector": "[role=\"button\"][data-testid=\"like\"]",
        "selectorType": "selector",
        "element": "",
        "serialType": "fixedValue",
        "serial": 1,
        "serialMin": 1,
        "serialMax": 50,
        "button": "left",
        "type": "click",
        "remark": ""
      }
    },
    {
      "type": "waitTime",
      "config": {
        "timeoutType": "randomInterval",
        "timeout": 30000,
        "timeoutMin": 2121,
        "timeoutMax": 3121,
        "remark": ""
      }
    },
    {
      "type": "passingElement",
      "config": {
        "selector": "[role=\"button\"][data-testid=\"like\"]",
        "selectorType": "selector",
        "element": "",
        "serialType": "fixedValue",
        "serial": 3,
        "serialMin": 1,
        "serialMax": 50,
        "remark": ""
      }
    },
    {
      "type": "waitTime",
      "config": {
        "timeoutType": "randomInterval",
        "timeout": 30000,
        "timeoutMin": 1112,
        "timeoutMax": 1212,
        "remark": ""
      }
    },
    {
      "type": "click",
      "config": {
        "selector": "[role=\"button\"][data-testid=\"like\"]",
        "selectorType": "selector",
        "element": "",
        "serialType": "fixedValue",
        "serial": 3,
        "serialMin": 1,
        "serialMax": 50,
        "button": "left",
        "type": "click",
        "remark": ""
      }
    },
    {
      "type": "waitTime",
      "config": {
        "timeoutType": "randomInterval",
        "timeout": 30000,
        "timeoutMin": 1212,
        "timeoutMax": 2123,
        "remark": ""
      }
    },
    {
      "type": "passingElement",
      "config": {
        "selector": "[data-testid=\"reply\"]",
        "selectorType": "selector",
        "element": "",
        "serialType": "fixedValue",
        "serial": 3,
        "serialMin": 1,
        "serialMax": 50,
        "remark": ""
      }
    },
    {
      "type": "waitTime",
      "config": {
        "timeoutType": "randomInterval",
        "timeout": 30000,
        "timeoutMin": 1212,
        "timeoutMax": 1312,
        "remark": ""
      }
    },
    {
      "type": "click",
      "config": {
        "selector": "[data-testid=\"reply\"]",
        "selectorType": "selector",
        "element": "",
        "serialType": "fixedValue",
        "serial": 3,
        "serialMin": 1,
        "serialMax": 50,
        "button": "left",
        "type": "click",
        "remark": ""
      }
    },
    {
      "type": "inputContent",
      "config": {
        "selector": "[role=\"dialog\"] [data-contents=\"true\"]",
        "serialType": "fixedValue",
        "selectorType": "selector",
        "element": "",
        "serial": 1,
        "serialMin": 1,
        "serialMax": 50,
        "intervals": 300,
        "content": "Good Luck!",
        "isRandom": "1",
        "randomContent": "Good Luck!\r\nHave a nice day~",
        "remark": ""
      }
    },
    {
      "type": "waitTime",
      "config": {
        "timeoutType": "randomInterval",
        "timeout": 30000,
        "timeoutMin": 2121,
        "timeoutMax": 3123,
        "remark": ""
      }
    },
    {
      "type": "passingElement",
      "config": {
        "selector": "[data-testid=\"tweetButton\"]",
        "selectorType": "selector",
        "element": "",
        "serialType": "fixedValue",
        "serial": 1,
        "serialMin": 1,
        "serialMax": 50,
        "remark": ""
      }
    },
    {
      "type": "waitTime",
      "config": {
        "timeoutType": "randomInterval",
        "timeout": 30000,
        "timeoutMin": 1121,
        "timeoutMax": 1212,
        "remark": ""
      }
    },
    {
      "type": "click",
      "config": {
        "selector": "[data-testid=\"tweetButton\"]",
        "selectorType": "selector",
        "element": "",
        "serialType": "fixedValue",
        "serial": 1,
        "serialMin": 1,
        "serialMax": 50,
        "button": "left",
        "type": "click",
        "remark": ""
      }
    },
    {
      "type": "waitTime",
      "config": {
        "timeoutType": "randomInterval",
        "timeout": 30000,
        "timeoutMin": 2124,
        "timeoutMax": 3212,
        "remark": ""
      }
    },
    {
      "type": "screenshotPage",
      "config": {
        "name": "",
        "path": "",
        "quality": 50,
        "format": "png",
        "fullPage": "0",
        "remark": ""
      }
    }
  ]

  // 存储通过 passingElement 获取到的元素
  const elementStore = {};

  // 辅助函数：通过 scrollType 与 position 判断如何滚动页面
  async function scrollPage(page, distance, scrollType, position) {
    if (scrollType === "pixel") {
      // 像素级滚动
      await page.evaluate((dist) => {
        window.scrollBy(0, dist);
      }, distance);
    } else if (scrollType === "position") {
      // 滚动到指定位置
      if (position === "top") {
        await page.evaluate(() => {
          window.scrollTo(0, 0);
        });
      } else if (position === "middle") {
        await page.evaluate(() => {
          window.scrollTo(0, document.body.scrollHeight / 2);
        });
      } else if (position === "bottom") {
        await page.evaluate(() => {
          window.scrollTo(0, document.body.scrollHeight);
        });
      }
    }
  }

  // 获取或者等待某个元素，并根据 serialType/serial 获取指定序号的元素
  async function getElement(page, config) {
    const { selector, serialType, serial } = config;
    // 如果是固定序号，获取所有再根据索引来取
    const elements = await page.$$(selector);
    // 注意数组索引从 0 开始，所以需要序号 - 1
    const idx = (serialType === "fixedValue") ? (serial - 1) : 0;
    if (idx < 0 || idx >= elements.length) {
      throw new Error(`无法根据序号 ${serial} 找到对应元素！`);
    }
    return elements[idx];
  }

  // 遍历脚本步骤并执行
  let page; // 将 page 在作用域外定义，以便在 newPage 步骤赋值后使用
  for (const step of scriptSteps) {
    const { type, config } = step;
    switch (type) {
      case "newPage": {
        page = await browser.newPage();
        break;
      }

      case "gotoUrl": {
        const { url, timeout } = config;
        await page.goto(url, { timeout });
        break;
      }

      case "waitForSelector": {
        const { selector, timeout } = config;
        await page.waitForSelector(selector, { timeout });
        break;
      }

      case "waitTime": {
        const { timeoutType, timeout, timeoutMin, timeoutMax } = config;
        if (timeoutType === "randomInterval") {
          // 使用外部已定义的 randomWait 或者自定义
          const waitTime = Math.floor(Math.random() * (timeoutMax - timeoutMin + 1) + timeoutMin);
          await new Promise((resolve) => setTimeout(resolve, waitTime));
        } else {
          // 普通等待
          await page.waitForTimeout(timeout);
        }
        break;
      }

      case "scrollPage": {
        const { distance, type: scrollAnim, scrollType, position } = config;
        await scrollPage(page, distance, scrollType, position);
        break;
      }

      case "passingElement": {
        // 把元素存到 elementStore 里
        const el = await getElement(page, config);
        elementStore[config.serial] = el;
        break;
      }

      case "click": {
        const { selector, selectorType, serialType, serial, button } = config;
        // 如果之前通过 passingElement 存储了元素，则点击存储的元素
        // 否则直接使用 page.click(selector)
        if (elementStore[serial]) {
          await elementStore[serial].click({ button });
        } else {
          await page.click(selector, { button });
        }
        break;
      }

      case "inputContent": {
        const {
          selector,
          serialType,
          serial,
          content,
          isRandom,
          randomContent,
          intervals
        } = config;

        const finalText = (isRandom === "1") ? randomContent : content;
        if (elementStore[serial]) {
          // 如果我们已经 passingElement 存储了元素
          await elementStore[serial].type(finalText, { delay: intervals || 0 });
        } else {
          await page.type(selector, finalText, { delay: intervals || 0 });
        }
        break;
      }

      case "screenshotPage": {
        const { path, quality, format, fullPage } = config;
        // 如果 path 为空，可自行定义默认保存路径
        const savePath = path || `screenshot.${format}`;
        await page.screenshot({
          path: savePath,
          type: format === "png" ? "png" : "jpeg",
          quality: format === "jpeg" ? quality : undefined, // png 不支持 quality 选项
          fullPage: fullPage === "1"
        });
        break;
      }

      default:
        // 其他类型暂未实现
        console.log(`未识别的步骤类型: ${type}`);
        break;
    }
  }
}

(async () => {
  const browser = await createBrowser();
  await autoScript(browser);
  // await browser.close(); // Only if you want to close the external Chrome instance.
})();
