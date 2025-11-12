import {ipcMain, app} from 'electron';
import path from 'path';
import type {SafeAny} from '../../../shared/types/db';
import {createLogger} from '../../../shared/utils/logger';
import {SERVICE_LOGGER_LABEL} from '../constants';
import {WindowDB} from '../db/window';
import puppeteer, {type Browser} from 'puppeteer';

const logger = createLogger(SERVICE_LOGGER_LABEL);

// Types for events
interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  pid: number;
}

interface ExtensionWindow {
  pid: number;
  bounds: WindowBounds;
  title?: string;
}

interface MouseEventData {
  x: number;
  y: number;
  button: number;
  clicks: number;
}

interface KeyboardEventData {
  keycode: number;
  rawcode: number;
  type: string;
}

interface WheelEventData {
  x: number;
  y: number;
  rotation: number;
  direction: number;
  amount: number;
}

interface SyncOptions {
  enableMouseSync?: boolean;
  enableKeyboardSync?: boolean;
  enableWheelSync?: boolean;
  enableCdpSync?: boolean; // Enable CDP-based synchronization
  mouseMoveThrottleMs?: number;
  mouseMoveThresholdPx?: number;
  wheelThrottleMs?: number;
  cdpSyncIntervalMs?: number; // Interval for CDP sync polling
}

// Load native addon
let windowAddon: SafeAny;
try {
  if (!app.isPackaged) {
    windowAddon = require(path.join(__dirname, '../src/native-addon/build/Release/', 'window-addon.node'));
  } else {
    const addonPath = path.join(
      process.resourcesPath,
      'app.asar.unpacked/node_modules/window-addon/',
      'window-addon.node',
    );
    windowAddon = require(addonPath);
  }
} catch (error) {
  logger.error('Failed to load window addon:', error);
}

// Load uiohook-napi
let uIOhook: SafeAny;
try {
  const uiohookModule = require('uiohook-napi');
  uIOhook = uiohookModule.uIOhook;
} catch (error) {
  logger.error('Failed to load uiohook-napi:', error);
}

class MultiWindowSyncService {
  private masterWindowPid: number | null = null;
  private slaveWindowPids: Set<number> = new Set();
  private masterWindowBounds: WindowBounds | null = null;
  private slaveWindowBounds: Map<number, WindowBounds> = new Map();
  private isCapturing: boolean = false;
  private windowManager: SafeAny = null;

  // Extension window tracking
  private extensionWindows: Map<number, ExtensionWindow[]> = new Map();
  private extensionMonitorInterval: NodeJS.Timeout | null = null;
  private readonly EXTENSION_MONITOR_INTERVAL_MS = 1000;

  // Sync options
  private syncOptions: SyncOptions = {
    enableMouseSync: true,
    enableKeyboardSync: true,
    enableWheelSync: true,
    enableCdpSync: false, // Disabled by default
    mouseMoveThrottleMs: 10,
    mouseMoveThresholdPx: 2,
    wheelThrottleMs: 50,
    cdpSyncIntervalMs: 100,
  };

  // CDP connections
  private cdpBrowsers: Map<number, Browser> = new Map();
  private cdpSyncInterval: NodeJS.Timeout | null = null;
  private lastScrollPosition: {x: number; y: number} = {x: 0, y: 0};

  // Throttling for mouse move events
  private lastMouseMoveTime: number = 0;
  private lastMousePosition: {x: number; y: number} = {x: 0, y: 0};

  // Throttling for wheel events
  private lastWheelTime: number = 0;

  constructor() {
    if (windowAddon) {
      this.windowManager = new windowAddon.WindowManager();
    }
  }

  /**
   * Start synchronization
   */
  async startSync(
    masterPid: number,
    slavePids: number[],
    options?: SyncOptions,
  ): Promise<{success: boolean; error?: string}> {
    try {
      if (this.isCapturing) {
        return {success: false, error: 'Sync already active'};
      }

      if (!uIOhook) {
        return {success: false, error: 'uiohook-napi not loaded'};
      }

      if (!this.windowManager) {
        return {success: false, error: 'Window manager not loaded'};
      }

      // Update sync options if provided
      if (options) {
        this.syncOptions = {...this.syncOptions, ...options};
      }

      // Set master and slave windows
      this.masterWindowPid = masterPid;
      this.slaveWindowPids = new Set(slavePids);

      // Get window bounds
      await this.updateWindowBounds();

      // Set up event listeners
      this.setupEventListeners();

      // Start capturing events
      uIOhook.start();
      this.isCapturing = true;

      // Start extension window monitoring
      this.startExtensionMonitoring();

      // Start CDP sync if enabled
      if (this.syncOptions.enableCdpSync) {
        await this.startCdpSync();
      }

      logger.info('Multi-window sync started', {
        masterPid,
        slavePids,
        masterBounds: this.masterWindowBounds,
        cdpEnabled: this.syncOptions.enableCdpSync,
      });

      return {success: true};
    } catch (error) {
      logger.error('Failed to start sync:', error);
      return {success: false, error: error instanceof Error ? error.message : 'Unknown error'};
    }
  }

  /**
   * Stop synchronization
   */
  async stopSync(): Promise<{success: boolean}> {
    try {
      if (!this.isCapturing) {
        return {success: true};
      }

      if (uIOhook) {
        uIOhook.stop();
      }

      this.removeEventListeners();
      this.stopExtensionMonitoring();
      await this.stopCdpSync();
      this.isCapturing = false;
      this.masterWindowPid = null;
      this.slaveWindowPids.clear();
      this.masterWindowBounds = null;
      this.slaveWindowBounds.clear();
      this.extensionWindows.clear();

      logger.info('Multi-window sync stopped');
      return {success: true};
    } catch (error) {
      logger.error('Failed to stop sync:', error);
      return {success: false};
    }
  }

  /**
   * Update window bounds for all windows
   */
  private async updateWindowBounds(): Promise<void> {
    if (!this.masterWindowPid) return;

    // Get master window bounds
    const masterBounds = this.windowManager.getWindowBounds(this.masterWindowPid);
    if (masterBounds.success) {
      this.masterWindowBounds = {
        x: masterBounds.x,
        y: masterBounds.y,
        width: masterBounds.width,
        height: masterBounds.height,
        pid: this.masterWindowPid,
      };
    }

    // Get slave window bounds
    for (const slavePid of this.slaveWindowPids) {
      const slaveBounds = this.windowManager.getWindowBounds(slavePid);
      if (slaveBounds.success) {
        this.slaveWindowBounds.set(slavePid, {
          x: slaveBounds.x,
          y: slaveBounds.y,
          width: slaveBounds.width,
          height: slaveBounds.height,
          pid: slavePid,
        });
      }
    }
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    if (!uIOhook) return;

    uIOhook.on('mousemove', this.handleMouseMove.bind(this));
    uIOhook.on('mousedown', this.handleMouseDown.bind(this));
    uIOhook.on('mouseup', this.handleMouseUp.bind(this));
    uIOhook.on('wheel', this.handleWheel.bind(this));
    uIOhook.on('keydown', this.handleKeyDown.bind(this));
    uIOhook.on('keyup', this.handleKeyUp.bind(this));
  }

  /**
   * Remove event listeners
   */
  private removeEventListeners(): void {
    if (!uIOhook) return;

    uIOhook.removeAllListeners('mousemove');
    uIOhook.removeAllListeners('mousedown');
    uIOhook.removeAllListeners('mouseup');
    uIOhook.removeAllListeners('wheel');
    uIOhook.removeAllListeners('keydown');
    uIOhook.removeAllListeners('keyup');
  }

  /**
   * Check if mouse is within master window
   */
  private isMouseInMasterWindow(x: number, y: number): boolean {
    if (!this.masterWindowBounds) return false;
    const {x: wx, y: wy, width, height} = this.masterWindowBounds;
    return x >= wx && x <= wx + width && y >= wy && y <= wy + height;
  }

  /**
   * Calculate relative position within master window
   */
  private calculateRelativePosition(x: number, y: number): {ratioX: number; ratioY: number} | null {
    if (!this.masterWindowBounds) return null;
    const {x: wx, y: wy, width, height} = this.masterWindowBounds;
    return {
      ratioX: (x - wx) / width,
      ratioY: (y - wy) / height,
    };
  }

  /**
   * Apply relative position to slave window
   */
  private applyToSlaveWindow(
    ratio: {ratioX: number; ratioY: number},
    slaveBounds: WindowBounds,
  ): {x: number; y: number} {
    return {
      x: Math.round(slaveBounds.x + ratio.ratioX * slaveBounds.width),
      y: Math.round(slaveBounds.y + ratio.ratioY * slaveBounds.height),
    };
  }

  /**
   * Handle mouse move events
   */
  private handleMouseMove(event: MouseEventData): void {
    if (!this.isCapturing || !this.masterWindowBounds) return;
    if (!this.syncOptions.enableMouseSync) return;

    const now = Date.now();
    const {x, y} = event;

    // Check if mouse is in master window
    if (!this.isMouseInMasterWindow(x, y)) return;

    // Throttle by time and distance
    const timeDiff = now - this.lastMouseMoveTime;
    const distanceX = Math.abs(x - this.lastMousePosition.x);
    const distanceY = Math.abs(y - this.lastMousePosition.y);
    const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);

    if (
      timeDiff < (this.syncOptions.mouseMoveThrottleMs || 10) &&
      distance < (this.syncOptions.mouseMoveThresholdPx || 2)
    ) {
      return;
    }

    this.lastMouseMoveTime = now;
    this.lastMousePosition = {x, y};

    // Calculate relative position
    const ratio = this.calculateRelativePosition(x, y);
    if (!ratio) return;

    // Send to all slave windows
    for (const [slavePid, slaveBounds] of this.slaveWindowBounds) {
      const slavePos = this.applyToSlaveWindow(ratio, slaveBounds);
      this.windowManager.sendMouseEvent(slavePid, slavePos.x, slavePos.y, 'mousemove');
    }
  }

  /**
   * Handle mouse down events
   */
  private handleMouseDown(event: MouseEventData): void {
    if (!this.isCapturing || !this.masterWindowBounds) return;
    if (!this.syncOptions.enableMouseSync) return;

    const {x, y, button} = event;
    if (!this.isMouseInMasterWindow(x, y)) return;

    const ratio = this.calculateRelativePosition(x, y);
    if (!ratio) return;

    const eventType = button === 1 ? 'mousedown' : button === 2 ? 'rightdown' : 'mousedown';

    for (const [slavePid, slaveBounds] of this.slaveWindowBounds) {
      const slavePos = this.applyToSlaveWindow(ratio, slaveBounds);
      this.windowManager.sendMouseEvent(slavePid, slavePos.x, slavePos.y, eventType);
    }
  }

  /**
   * Handle mouse up events
   */
  private handleMouseUp(event: MouseEventData): void {
    if (!this.isCapturing || !this.masterWindowBounds) return;
    if (!this.syncOptions.enableMouseSync) return;

    const {x, y, button} = event;
    if (!this.isMouseInMasterWindow(x, y)) return;

    const ratio = this.calculateRelativePosition(x, y);
    if (!ratio) return;

    const eventType = button === 1 ? 'mouseup' : button === 2 ? 'rightup' : 'mouseup';

    for (const [slavePid, slaveBounds] of this.slaveWindowBounds) {
      const slavePos = this.applyToSlaveWindow(ratio, slaveBounds);
      this.windowManager.sendMouseEvent(slavePid, slavePos.x, slavePos.y, eventType);
    }
  }

  /**
   * Handle wheel events (with optimized scrolling strategy)
   * Based on Chrome-Manager's layered wheel handling:
   * - Small scrolls (≤1): Send directly
   * - Medium scrolls (2-3): Amplify for smoother scrolling
   * - Large scrolls (>3): Use multiplier for fast scrolling
   */
  private handleWheel(event: WheelEventData): void {
    if (!this.isCapturing || !this.masterWindowBounds) return;
    if (!this.syncOptions.enableWheelSync) return;

    const now = Date.now();
    if (now - this.lastWheelTime < (this.syncOptions.wheelThrottleMs || 50)) return;
    this.lastWheelTime = now;

    const {x, y, rotation, amount} = event;
    if (!this.isMouseInMasterWindow(x, y)) return;

    // Optimized wheel handling based on amount
    // amount is typically in range -3 to 3
    let deltaY = rotation > 0 ? -amount : amount;

    // Apply layered scrolling strategy
    const absAmount = Math.abs(amount);
    if (absAmount <= 1) {
      // Small scroll: use as-is
      deltaY = deltaY;
    } else if (absAmount <= 3) {
      // Medium scroll: amplify slightly for better responsiveness
      deltaY = deltaY * 1.5;
    } else {
      // Large scroll: use multiplier for fast scrolling
      deltaY = deltaY * 2.0;
    }

    // Round to integer
    deltaY = Math.round(deltaY);

    for (const slavePid of this.slaveWindowPids) {
      this.windowManager.sendWheelEvent(slavePid, 0, deltaY);
    }
  }

  /**
   * Handle key down events
   */
  private handleKeyDown(event: KeyboardEventData): void {
    if (!this.isCapturing) return;
    if (!this.syncOptions.enableKeyboardSync) return;

    const {keycode} = event;

    for (const slavePid of this.slaveWindowPids) {
      this.windowManager.sendKeyboardEvent(slavePid, keycode, 'keydown');
    }
  }

  /**
   * Handle key up events
   */
  private handleKeyUp(event: KeyboardEventData): void {
    if (!this.isCapturing) return;
    if (!this.syncOptions.enableKeyboardSync) return;

    const {keycode} = event;

    for (const slavePid of this.slaveWindowPids) {
      this.windowManager.sendKeyboardEvent(slavePid, keycode, 'keyup');
    }
  }

  /**
   * Get current sync status
   */
  getStatus(): {
    isActive: boolean;
    masterPid: number | null;
    slavePids: number[];
  } {
    return {
      isActive: this.isCapturing,
      masterPid: this.masterWindowPid,
      slavePids: Array.from(this.slaveWindowPids),
    };
  }

  /**
   * Start monitoring extension windows (popup windows)
   */
  private startExtensionMonitoring(): void {
    if (this.extensionMonitorInterval) return;

    this.extensionMonitorInterval = setInterval(() => {
      this.detectExtensionWindows();
    }, this.EXTENSION_MONITOR_INTERVAL_MS);

    // Initial detection
    this.detectExtensionWindows();
  }

  /**
   * Stop monitoring extension windows
   */
  private stopExtensionMonitoring(): void {
    if (this.extensionMonitorInterval) {
      clearInterval(this.extensionMonitorInterval);
      this.extensionMonitorInterval = null;
    }
  }

  /**
   * Detect extension windows for all managed PIDs
   * This method uses Native Addon's window enumeration which already
   * distinguishes between main windows and extension windows
   */
  private detectExtensionWindows(): void {
    // Note: The native addon's FindWindowsByPid or GetWindowsForPid
    // already identifies extension windows (isExtension flag)
    // For now, we rely on the native addon's existing window management
    // In the future, we could enhance this to track extension windows separately
    // and sync their positions/actions as well
  }

  /**
   * Start CDP-based synchronization
   * This connects to Chrome instances via CDP and syncs page scrolling
   */
  private async startCdpSync(): Promise<void> {
    try {
      // Get CDP endpoints for all windows
      if (!this.masterWindowPid) return;

      const masterWindow = await WindowDB.getByPid(this.masterWindowPid);
      if (masterWindow && masterWindow.debug_port) {
        try {
          const browser = await puppeteer.connect({
            browserWSEndpoint: `ws://127.0.0.1:${masterWindow.debug_port}/devtools/browser`,
            defaultViewport: null,
          });
          this.cdpBrowsers.set(this.masterWindowPid, browser);
        } catch (error) {
          logger.error(`Failed to connect to master window CDP on port ${masterWindow.debug_port}:`, error);
        }
      }

      // Connect to slave windows
      for (const slavePid of this.slaveWindowPids) {
        const slaveWindow = await WindowDB.getByPid(slavePid);
        if (slaveWindow && slaveWindow.debug_port) {
          try {
            const browser = await puppeteer.connect({
              browserWSEndpoint: `ws://127.0.0.1:${slaveWindow.debug_port}/devtools/browser`,
              defaultViewport: null,
            });
            this.cdpBrowsers.set(slavePid, browser);
          } catch (error) {
            logger.error(`Failed to connect to slave window CDP on port ${slaveWindow.debug_port}:`, error);
          }
        }
      }

      // Start periodic scroll sync
      this.cdpSyncInterval = setInterval(() => {
        this.syncScrollPositions();
      }, this.syncOptions.cdpSyncIntervalMs || 100);

      logger.info('CDP sync started', {
        connectedBrowsers: this.cdpBrowsers.size,
      });
    } catch (error) {
      logger.error('Failed to start CDP sync:', error);
    }
  }

  /**
   * Stop CDP synchronization
   */
  private async stopCdpSync(): Promise<void> {
    // Stop interval
    if (this.cdpSyncInterval) {
      clearInterval(this.cdpSyncInterval);
      this.cdpSyncInterval = null;
    }

    // Disconnect all CDP connections
    for (const [pid, browser] of this.cdpBrowsers) {
      try {
        await browser.disconnect();
      } catch (error) {
        logger.error(`Failed to disconnect CDP browser for PID ${pid}:`, error);
      }
    }
    this.cdpBrowsers.clear();
  }

  /**
   * Sync scroll positions from master to slave windows
   */
  private async syncScrollPositions(): Promise<void> {
    try {
      if (!this.masterWindowPid) return;

      const masterBrowser = this.cdpBrowsers.get(this.masterWindowPid);
      if (!masterBrowser) return;

      // Get master window scroll position
      const masterPages = await masterBrowser.pages();
      if (masterPages.length === 0) return;

      const masterPage = masterPages[0];
      const scrollPosition = await masterPage.evaluate(() => ({
        x: window.scrollX,
        y: window.scrollY,
      }));

      // Check if scroll position changed
      if (
        scrollPosition.x === this.lastScrollPosition.x &&
        scrollPosition.y === this.lastScrollPosition.y
      ) {
        return;
      }

      this.lastScrollPosition = scrollPosition;

      // Apply to slave windows
      for (const slavePid of this.slaveWindowPids) {
        const slaveBrowser = this.cdpBrowsers.get(slavePid);
        if (!slaveBrowser) continue;

        try {
          const slavePages = await slaveBrowser.pages();
          if (slavePages.length === 0) continue;

          const slavePage = slavePages[0];
          await slavePage.evaluate(
            (x, y) => {
              window.scrollTo(x, y);
            },
            scrollPosition.x,
            scrollPosition.y,
          );
        } catch (error) {
          // Silently ignore errors (page might be navigating, etc.)
        }
      }
    } catch (error) {
      // Silently ignore errors to avoid flooding logs
    }
  }
}

// Singleton instance
const syncService = new MultiWindowSyncService();

/**
 * Initialize multi-window sync service
 */
export const initMultiWindowSyncService = () => {
  logger.info('Initializing multi-window sync service...');

  // Start sync
  ipcMain.handle('multi-window-sync-start', async (_, args: {masterWindowId: number; slaveWindowIds: number[]}) => {
    try {
      const {masterWindowId, slaveWindowIds} = args;

      // Get window PIDs from database
      const masterWindow = await WindowDB.getById(masterWindowId);
      if (!masterWindow || !masterWindow.pid) {
        return {success: false, error: 'Master window not found or not running'};
      }

      const slaveWindows = await Promise.all(slaveWindowIds.map(id => WindowDB.getById(id)));
      const slavePids = slaveWindows
        .filter(w => w && w.pid)
        .map(w => w!.pid as number);

      if (slavePids.length === 0) {
        return {success: false, error: 'No valid slave windows found'};
      }

      return await syncService.startSync(masterWindow.pid, slavePids);
    } catch (error) {
      logger.error('Error starting sync:', error);
      return {success: false, error: error instanceof Error ? error.message : 'Unknown error'};
    }
  });

  // Stop sync
  ipcMain.handle('multi-window-sync-stop', async () => {
    return await syncService.stopSync();
  });

  // Get sync status
  ipcMain.handle('multi-window-sync-status', async () => {
    return syncService.getStatus();
  });

  logger.info('Multi-window sync service initialized');
};
