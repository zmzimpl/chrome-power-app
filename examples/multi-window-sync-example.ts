/**
 * 多窗口同步功能示例
 *
 * 此文件展示如何使用多窗口同步API
 */

import { ipcRenderer } from 'electron';

/**
 * 示例1：基础同步 - 启动和停止
 */
async function basicSyncExample() {
  console.log('=== 示例1：基础同步 ===');

  // 假设已经创建了窗口 1, 2, 3
  const masterWindowId = 1;
  const slaveWindowIds = [2, 3];

  // 启动同步
  const startResult = await ipcRenderer.invoke('multi-window-sync-start', {
    masterWindowId,
    slaveWindowIds,
  });

  if (startResult.success) {
    console.log('✅ 同步已启动');
    console.log('现在在窗口1中操作，窗口2和3会跟随同步');

    // 运行10秒后停止
    await new Promise(resolve => setTimeout(resolve, 10000));

    const stopResult = await ipcRenderer.invoke('multi-window-sync-stop');
    if (stopResult.success) {
      console.log('✅ 同步已停止');
    }
  } else {
    console.error('❌ 启动失败:', startResult.error);
  }
}

/**
 * 示例2：高级配置 - 自定义节流参数
 */
async function advancedConfigExample() {
  console.log('=== 示例2：高级配置 ===');

  const result = await ipcRenderer.invoke('multi-window-sync-start', {
    masterWindowId: 1,
    slaveWindowIds: [2, 3, 4],
    options: {
      enableMouseSync: true,
      enableKeyboardSync: true,
      enableWheelSync: true,
      enableCdpSync: false,
      // 更快的响应速度
      mouseMoveThrottleMs: 5,
      mouseMoveThresholdPx: 1,
      wheelThrottleMs: 30,
    },
  });

  if (result.success) {
    console.log('✅ 高性能同步已启动');
  }
}

/**
 * 示例3：仅鼠标同步
 */
async function mouseOnlySyncExample() {
  console.log('=== 示例3：仅鼠标同步 ===');

  const result = await ipcRenderer.invoke('multi-window-sync-start', {
    masterWindowId: 1,
    slaveWindowIds: [2, 3],
    options: {
      enableMouseSync: true,
      enableKeyboardSync: false,  // 禁用键盘
      enableWheelSync: false,     // 禁用滚轮
    },
  });

  if (result.success) {
    console.log('✅ 仅鼠标同步已启动');
  }
}

/**
 * 示例4：启用 CDP 页面滚动同步
 */
async function cdpSyncExample() {
  console.log('=== 示例4：CDP 页面滚动同步 ===');

  // 注意：使用 CDP 同步前，确保窗口启动时开启了调试端口
  const result = await ipcRenderer.invoke('multi-window-sync-start', {
    masterWindowId: 1,
    slaveWindowIds: [2, 3],
    options: {
      enableMouseSync: true,
      enableKeyboardSync: true,
      enableWheelSync: true,
      enableCdpSync: true,        // 启用 CDP 同步
      cdpSyncIntervalMs: 100,     // 每100ms同步一次滚动位置
    },
  });

  if (result.success) {
    console.log('✅ CDP 同步已启动');
    console.log('页面滚动位置将通过 CDP 精确同步');
  }
}

/**
 * 示例5：监控同步状态
 */
async function monitorSyncStatus() {
  console.log('=== 示例5：监控同步状态 ===');

  // 启动同步
  await ipcRenderer.invoke('multi-window-sync-start', {
    masterWindowId: 1,
    slaveWindowIds: [2, 3, 4],
  });

  // 每秒检查一次状态
  const intervalId = setInterval(async () => {
    const status = await ipcRenderer.invoke('multi-window-sync-status');
    console.log('同步状态:', {
      活跃: status.isActive,
      主窗口PID: status.masterPid,
      从窗口PIDs: status.slavePids,
    });
  }, 1000);

  // 10秒后停止监控
  setTimeout(() => {
    clearInterval(intervalId);
    ipcRenderer.invoke('multi-window-sync-stop');
  }, 10000);
}

/**
 * 示例6：React 组件中使用
 */
function ReactComponentExample() {
  // 这是一个伪代码示例，展示如何在 React 组件中使用

  /*
  import React, { useState } from 'react';
  import { ipcRenderer } from 'electron';

  function MultiWindowSyncControl() {
    const [isSyncing, setIsSyncing] = useState(false);
    const [masterWindowId, setMasterWindowId] = useState(1);
    const [slaveWindowIds, setSlaveWindowIds] = useState([2, 3]);

    const handleStartSync = async () => {
      const result = await ipcRenderer.invoke('multi-window-sync-start', {
        masterWindowId,
        slaveWindowIds,
      });

      if (result.success) {
        setIsSyncing(true);
        alert('同步已启动');
      } else {
        alert('启动失败: ' + result.error);
      }
    };

    const handleStopSync = async () => {
      const result = await ipcRenderer.invoke('multi-window-sync-stop');
      if (result.success) {
        setIsSyncing(false);
        alert('同步已停止');
      }
    };

    return (
      <div>
        <h2>多窗口同步控制</h2>

        <div>
          <label>主窗口ID:</label>
          <input
            type="number"
            value={masterWindowId}
            onChange={e => setMasterWindowId(parseInt(e.target.value))}
          />
        </div>

        <div>
          <label>从窗口IDs (逗号分隔):</label>
          <input
            type="text"
            value={slaveWindowIds.join(',')}
            onChange={e => setSlaveWindowIds(e.target.value.split(',').map(id => parseInt(id)))}
          />
        </div>

        <div>
          {isSyncing ? (
            <button onClick={handleStopSync}>停止同步</button>
          ) : (
            <button onClick={handleStartSync}>启动同步</button>
          )}
        </div>

        <div>
          状态: {isSyncing ? '✅ 同步中' : '⭕ 未同步'}
        </div>
      </div>
    );
  }
  */

  console.log('参考上面的 React 组件示例代码');
}

/**
 * 示例7：错误处理最佳实践
 */
async function errorHandlingExample() {
  console.log('=== 示例7：错误处理 ===');

  try {
    const result = await ipcRenderer.invoke('multi-window-sync-start', {
      masterWindowId: 1,
      slaveWindowIds: [2, 3],
    });

    if (!result.success) {
      // 处理不同的错误情况
      if (result.error?.includes('not found')) {
        console.error('窗口未找到，请确保窗口正在运行');
      } else if (result.error?.includes('not loaded')) {
        console.error('系统组件未加载，请检查依赖安装');
      } else if (result.error?.includes('already active')) {
        console.error('同步已经在运行中');
      } else {
        console.error('未知错误:', result.error);
      }
      return;
    }

    console.log('✅ 同步启动成功');

    // 使用完后记得停止
    await ipcRenderer.invoke('multi-window-sync-stop');

  } catch (error) {
    console.error('调用API时发生异常:', error);
  }
}

/**
 * 示例8：性能优化配置
 */
async function performanceOptimizationExample() {
  console.log('=== 示例8：性能优化 ===');

  // 场景1：低性能模式（适合大量窗口或低配置机器）
  const lowPerformanceMode = {
    masterWindowId: 1,
    slaveWindowIds: [2, 3, 4, 5, 6],
    options: {
      mouseMoveThrottleMs: 20,      // 增加节流时间
      mouseMoveThresholdPx: 5,      // 增加移动阈值
      wheelThrottleMs: 100,         // 滚轮节流更激进
      enableCdpSync: false,         // 禁用 CDP（开销较大）
    },
  };

  // 场景2：高性能模式（适合少量窗口或高配置机器）
  const highPerformanceMode = {
    masterWindowId: 1,
    slaveWindowIds: [2, 3],
    options: {
      mouseMoveThrottleMs: 5,       // 最小节流
      mouseMoveThresholdPx: 1,      // 最小阈值
      wheelThrottleMs: 20,          // 快速响应
      enableCdpSync: true,          // 启用 CDP 精确同步
      cdpSyncIntervalMs: 50,        // 高频同步
    },
  };

  // 根据需求选择配置
  const config = lowPerformanceMode; // 或 highPerformanceMode

  const result = await ipcRenderer.invoke('multi-window-sync-start', config);
  console.log(result.success ? '✅ 已启动' : '❌ 启动失败');
}

// 导出所有示例
export {
  basicSyncExample,
  advancedConfigExample,
  mouseOnlySyncExample,
  cdpSyncExample,
  monitorSyncStatus,
  ReactComponentExample,
  errorHandlingExample,
  performanceOptimizationExample,
};

// 如果直接运行此文件，执行基础示例
if (require.main === module) {
  basicSyncExample().catch(console.error);
}
