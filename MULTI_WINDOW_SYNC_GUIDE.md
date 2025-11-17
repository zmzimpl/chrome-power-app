# 多窗口同步功能使用指南

## 📋 概述

多窗口同步功能允许你将一个主窗口的鼠标、键盘操作实时同步到多个从窗口，实现批量操作和自动化控制。

## ✨ 功能特性

### 阶段1：MVP基础版本
- ✅ **鼠标事件同步**：移动、点击、右键
- ✅ **键盘输入同步**：按键按下和释放
- ✅ **主从窗口管理**：支持一个主窗口控制多个从窗口
- ✅ **相对坐标映射**：自动适配不同窗口尺寸

### 阶段2：增强版本
- ✅ **扩展窗口同步**：支持浏览器扩展弹出窗口
- ✅ **滚轮事件优化**：分层滚动策略，小滚动、中等滚动、大滚动智能处理
- ✅ **事件过滤和节流**：可配置的节流参数，减少系统负载
- ✅ **CDP页面滚动同步**：通过Chrome DevTools Protocol精确同步页面滚动位置

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
```

项目会自动安装 `uiohook-napi` 依赖。

### 2. 编译 Native Addon

```bash
# Windows
npm run build:native-addon

# macOS (x64)
npm run build:native-addon:mac-x64

# macOS (arm64)
npm run build:native-addon:mac-arm64
```

### 3. 启动应用

```bash
npm run watch
```

## 📖 API 使用

### 从渲染进程调用

```typescript
// 启动同步
const result = await ipcRenderer.invoke('multi-window-sync-start', {
  masterWindowId: 1,      // 主窗口ID
  slaveWindowIds: [2, 3, 4], // 从窗口ID数组
  options: {              // 可选配置
    enableMouseSync: true,
    enableKeyboardSync: true,
    enableWheelSync: true,
    enableCdpSync: false,  // CDP同步需要窗口开启调试端口
    mouseMoveThrottleMs: 10,
    mouseMoveThresholdPx: 2,
    wheelThrottleMs: 50,
    cdpSyncIntervalMs: 100
  }
});

if (result.success) {
  console.log('同步已启动');
} else {
  console.error('启动失败:', result.error);
}

// 停止同步
await ipcRenderer.invoke('multi-window-sync-stop');

// 获取同步状态
const status = await ipcRenderer.invoke('multi-window-sync-status');
console.log(status);
// 输出: { isActive: true, masterPid: 12345, slavePids: [23456, 34567] }
```

### 配置选项说明

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `enableMouseSync` | boolean | true | 启用鼠标事件同步 |
| `enableKeyboardSync` | boolean | true | 启用键盘事件同步 |
| `enableWheelSync` | boolean | true | 启用滚轮事件同步 |
| `enableCdpSync` | boolean | false | 启用CDP页面滚动同步 |
| `mouseMoveThrottleMs` | number | 10 | 鼠标移动事件节流时间（毫秒） |
| `mouseMoveThresholdPx` | number | 2 | 鼠标移动距离阈值（像素） |
| `wheelThrottleMs` | number | 50 | 滚轮事件节流时间（毫秒） |
| `cdpSyncIntervalMs` | number | 100 | CDP同步轮询间隔（毫秒） |

## 🔧 技术实现

### 架构设计

```
┌─────────────────────────────────────────────────┐
│           Electron 主进程                        │
│  ┌──────────────────────────────────────────┐  │
│  │  事件捕获层 (uiohook-napi)               │  │
│  │  - 全局键盘钩子                           │  │
│  │  - 全局鼠标钩子                           │  │
│  └──────────────┬───────────────────────────┘  │
│                 │ 事件流                         │
│  ┌──────────────▼───────────────────────────┐  │
│  │  事件处理与分发层 (TypeScript)           │  │
│  │  - 过滤与节流                             │  │
│  │  - 坐标转换 (相对位置映射)               │  │
│  │  - 主从窗口管理                           │  │
│  └──────────────┬───────────────────────────┘  │
│                 │ 分发                          │
│  ┌──────────────▼───────────────────────────┐  │
│  │  窗口消息发送层 (Native Addon)           │  │
│  │  - Windows: PostMessage                  │  │
│  │  - macOS: CGEvent API                    │  │
│  └──────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
         │              │              │
    ┌────▼────┐    ┌───▼────┐    ┌───▼────┐
    │Chrome 1 │    │Chrome 2│    │Chrome 3│
    │(主窗口) │    │(从窗口)│    │(从窗口)│
    └─────────┘    └────────┘    └────────┘
```

### 核心算法

#### 1. 相对坐标映射

```typescript
// 计算主窗口中的相对位置
ratioX = (mouseX - masterWindow.x) / masterWindow.width
ratioY = (mouseY - masterWindow.y) / masterWindow.height

// 应用到从窗口
slaveX = slaveWindow.x + (ratioX * slaveWindow.width)
slaveY = slaveWindow.y + (ratioY * slaveWindow.height)
```

#### 2. 滚轮事件分层处理

```typescript
if (absAmount <= 1) {
  // 小滚动：保持原样
  delta = amount
} else if (absAmount <= 3) {
  // 中等滚动：放大1.5倍
  delta = amount * 1.5
} else {
  // 大滚动：放大2倍
  delta = amount * 2.0
}
```

#### 3. 鼠标移动节流

```typescript
// 双重节流：时间 + 距离
if (timeDiff < 10ms && distance < 2px) {
  // 忽略此次移动
  return
}
```

## 🎯 使用场景

1. **多账号管理**：同时控制多个浏览器账号进行相同操作
2. **批量测试**：在多个环境中同步测试流程
3. **自动化演示**：同时展示多个窗口的操作效果
4. **数据采集**：批量执行相同的数据采集任务

## ⚠️ 注意事项

### Windows 平台
- 需要**管理员权限**才能使用全局钩子
- 某些安全软件可能会拦截全局钩子

### macOS 平台
- 需要授予**辅助功能权限**
- 首次运行时会自动提示，请按照提示操作
- 可以在 `系统偏好设置 > 安全性与隐私 > 隐私 > 辅助功能` 中手动授权

### CDP 同步
- 需要窗口启动时开启调试端口
- 确保 `debug_port` 字段在数据库中正确设置
- CDP 同步比事件同步更精确，但开销稍大

## 🐛 故障排除

### 1. 同步无法启动

**问题**：调用 `multi-window-sync-start` 返回失败

**解决方案**：
- 检查所有窗口是否正在运行（有 PID）
- 检查是否授予了必要的系统权限
- 查看主进程日志获取详细错误信息

### 2. 鼠标/键盘事件不同步

**问题**：事件捕获但不分发

**解决方案**：
- 确保鼠标在主窗口内部操作
- 检查 `enableMouseSync` / `enableKeyboardSync` 是否开启
- 尝试调整节流参数

### 3. 滚轮同步不流畅

**问题**：滚动有卡顿或不响应

**解决方案**：
- 调整 `wheelThrottleMs` 参数（降低值以提高响应）
- 检查系统资源占用
- 尝试禁用 CDP 同步以减少开销

### 4. macOS 上无法捕获事件

**问题**：事件完全不工作

**解决方案**：
```bash
# 检查辅助功能权限
# 系统偏好设置 > 安全性与隐私 > 隐私 > 辅助功能
# 确保 Chrome Power 或 Electron 已添加到列表中
```

## 📊 性能优化建议

1. **减少同步窗口数量**：同时同步的窗口越多，性能开销越大
2. **调整节流参数**：根据实际需求调整事件节流时间
3. **选择性启用功能**：如果不需要滚轮或键盘同步，可以禁用以减少开销
4. **CDP 按需使用**：仅在需要精确页面同步时开启 CDP

## 🔮 未来计划

- [ ] 录制和回放功能
- [ ] 自定义同步规则（选择性同步特定操作）
- [ ] 多主窗口模式
- [ ] 同步动作的延迟和随机化（模拟人类操作）
- [ ] UI 集成（图形化配置界面）

## 📝 更新日志

### v1.0.0 (2025-01-12)
- ✅ 实现基础鼠标、键盘、滚轮事件同步
- ✅ 添加主从窗口管理
- ✅ 实现扩展窗口监控
- ✅ 添加滚轮事件优化策略
- ✅ 实现事件过滤和节流
- ✅ 集成 CDP 页面滚动同步

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

本功能遵循项目的 AGPL 许可证。
