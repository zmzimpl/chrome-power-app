# Chrome Power

![Visualization](pic.png)

---

**Warning: 此项目只有作者一人在维护，指纹启动方式目前已经失效，目前已在代码中注释掉了（有条件请自行修改编译）。目前只单纯作为 Chrome 多开管理工具使用，支持独立窗口，http/socks5 代理，API 管理等。**

首款开源~~指纹浏览器~~ Chrome 多开管理工具。基于 Puppeteer、Electron、React 开发。

此软件遵循AGPL协议，因此如果你想对其进行修改发布，请保持开源。

Chromium 源码修改请参考 [chrome-power-chromium](https://github.com/zmzimpl/chrome-power-chromium)

## 免责声明

本代码仅用于技术交流、学习，请勿用于非法、商业用途。本代码不保存任何用户数据，同时也不对用户数据负责，请知悉。

## 开始

按照以下步骤开始使用此软件：

- 下载安装包[点击此处下载](https://github.com/zmzimpl/chrome-power-app/releases)
- 建议前往设置页面设置你的缓存目录。
- 创建代理
- 创建窗口
  - 创建空白窗口
  - 导入窗口
    - 从模板导入
    - 从 AdsPower 导入

## 功能

- [x] 多窗口管理
- [x] 代理设置
- [x] 中英文支持
- [x] Puppeteer/Playwright/Selenium 接入
- [x] ~~支持 cookie 导入~~
- [x] Mac 安装支持
- [x] 扩展程序管理
- [ ] 同步操作
- [ ] 自动化脚本

## 本地运行/打包

环境：Node v18.18.2， npm 9.8.1

- 安装依赖 `npm i`
- 运行调试 `npm run watch`
- （非必要）打包部署 `npm run publish`，注意打包时要把开发环境停掉，不然会导致 sqlite3 的包打包不了

## API 文档

[Postman API](https://documenter.getpostman.com/view/25586363/2sA3BkdZ61#intro)

## FAQ

### Windows 10 安装之后闪退

如遇闪退，尝试在安装完成之后，右键启动程序 - 属性，在目标的末尾加入 --no-sandbox 或者 --in-process-gpu，再尝试启动

## 打赏

🙌你可以通过向下面的钱包打赏一杯咖啡来支持我

Bitcoin Address: `bc1p0uex9rn8nd9uyguulp6r3d3t9kylrk42dg6sq22f3h5rktlk22ks6mlv6t`

Ethereum Address: `0x83DF381FF65806B68AA1963636f4ca87990F2860`

Solana Address: `HYKo3uVuCQzWkWUkGcGwiDAAsxPYyJZtjf28Xk143eb1`
