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
  type: string;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  time?: number;
}

interface WheelEventData {
  x: number;
  y: number;
  rotation: number;
  direction: number;
  amount: number;
}

// UIOHook keycode to Windows Virtual-Key Code mapping
// Based on uiohook keycodes: https://github.com/kwhat/libuiohook/blob/master/include/uiohook.h
const UIOHOOK_TO_WINDOWS_VK: Record<number, number> = {
  // Letters (A-Z): uiohook 30-55 -> Windows VK 0x41-0x5A
  30: 0x41, 31: 0x42, 32: 0x43, 33: 0x44, 34: 0x45, 35: 0x46, 36: 0x47, 37: 0x48,
  38: 0x49, 39: 0x4A, 40: 0x4B, 41: 0x4C, 42: 0x4D, 43: 0x4E, 44: 0x4F, 45: 0x50,
  46: 0x51, 47: 0x52, 48: 0x53, 49: 0x54, 50: 0x55, 51: 0x56, 52: 0x57, 53: 0x58,
  54: 0x59, 55: 0x5A,

  // Numbers (0-9): uiohook 2-11 -> Windows VK 0x30-0x39
  11: 0x30, 2: 0x31, 3: 0x32, 4: 0x33, 5: 0x34, 6: 0x35, 7: 0x36, 8: 0x37,
  9: 0x38, 10: 0x39,

  // Function keys: F1-F12
  59: 0x70, 60: 0x71, 61: 0x72, 62: 0x73, 63: 0x74, 64: 0x75,
  65: 0x76, 66: 0x77, 67: 0x78, 68: 0x79, 69: 0x7A, 70: 0x7B,

  // Special keys
  1: 0x1B,    // Escape
  28: 0x0D,   // Enter
  14: 0x08,   // Backspace
  15: 0x09,   // Tab
  57: 0x20,   // Space
  42: 0x10,   // Left Shift
  54: 0x10,   // Right Shift
  29: 0x11,   // Left Ctrl
  97: 0x11,   // Right Ctrl
  56: 0x12,   // Left Alt
  100: 0x12,  // Right Alt

  // Arrow keys
  103: 0x26,  // Up
  108: 0x28,  // Down
  105: 0x25,  // Left
  106: 0x27,  // Right

  // Other keys
  83: 0x2E,   // Delete
  82: 0x2D,   // Insert
  71: 0x24,   // Home
  79: 0x23,   // End
  73: 0x21,   // Page Up
  81: 0x22,   // Page Down
  58: 0x14,   // Caps Lock
  69: 0x90,   // Num Lock
  70: 0x91,   // Scroll Lock
};

// UIOHook keycode to macOS CGKeyCode mapping
const UIOHOOK_TO_MACOS_CGKEY: Record<number, number> = {
  // Letters (A-Z)
  30: 0, 31: 11, 32: 8, 33: 2, 34: 14, 35: 3, 36: 5, 37: 4,
  38: 34, 39: 38, 40: 40, 41: 37, 42: 46, 43: 45, 44: 31, 45: 35,
  46: 12, 47: 15, 48: 1, 49: 17, 50: 32, 51: 9, 52: 13, 53: 7,
  54: 16, 55: 6,

  // Numbers (0-9)
  11: 29, 2: 18, 3: 19, 4: 20, 5: 21, 6: 23, 7: 22, 8: 26, 9: 28, 10: 25,

  // Function keys: F1-F12
  59: 122, 60: 120, 61: 99, 62: 118, 63: 96, 64: 97,
  65: 98, 66: 100, 67: 101, 68: 109, 69: 103, 70: 111,

  // Special keys
  1: 53,    // Escape
  28: 36,   // Enter
  14: 51,   // Backspace
  15: 48,   // Tab
  57: 49,   // Space
  42: 56,   // Left Shift
  54: 60,   // Right Shift
  29: 59,   // Left Ctrl
  97: 62,   // Right Ctrl
  56: 58,   // Left Alt/Option
  100: 61,  // Right Alt/Option

  // Arrow keys
  103: 126, // Up
  108: 125, // Down
  105: 123, // Left
  106: 124, // Right

  // Other keys
  83: 117,  // Delete
  82: 114,  // Insert/Help
  71: 115,  // Home
  79: 119,  // End
  73: 116,  // Page Up
  81: 121,  // Page Down
  58: 57,   // Caps Lock
};

/**
 * Convert UIOHook keycode to system-native keycode
 */
function convertKeyCode(uiohookKeycode: number): number {
  if (process.platform === 'win32') {
    const vkCode = UIOHOOK_TO_WINDOWS_VK[uiohookKeycode];
    if (vkCode) {
      logger.debug(`Converted uiohook keycode ${uiohookKeycode} to Windows VK ${vkCode} (0x${vkCode.toString(16)})`);
      return vkCode;
    }
  } else if (process.platform === 'darwin') {
    const cgKeyCode = UIOHOOK_TO_MACOS_CGKEY[uiohookKeycode];
    if (cgKeyCode !== undefined) {
      logger.debug(`Converted uiohook keycode ${uiohookKeycode} to macOS CGKeyCode ${cgKeyCode}`);
      return cgKeyCode;
    }
  }

  // Fallback: return original keycode if no mapping found
  logger.warn(`No keycode mapping found for uiohook keycode ${uiohookKeycode} on platform ${process.platform}, using original`);
  return uiohookKeycode;
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

  // Focus tracking - tracks if mouse is currently in master window
  // Used to determine if keyboard events should be synchronized
  private isMouseInMaster: boolean = false;
  private lastMouseCheckTime: number = 0;
  private readonly MOUSE_FOCUS_TIMEOUT_MS = 500; // Consider focus lost after 500ms without mouse movement in master

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

      // Initialize focus tracking - assume user is focused on master window when starting sync
      // This allows keyboard input to work immediately without requiring mouse movement first
      this.isMouseInMaster = true;
      this.lastMouseCheckTime = Date.now();

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

      // Reset focus tracking
      this.isMouseInMaster = false;
      this.lastMouseCheckTime = 0;

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
    try {
      if (!this.isCapturing || !this.masterWindowBounds) return;

      const now = Date.now();
      const {x, y} = event;

      // Check if mouse is in master window and update focus tracking
      const inMaster = this.isMouseInMasterWindow(x, y);
      if (inMaster) {
        this.isMouseInMaster = true;
        this.lastMouseCheckTime = now;
      } else {
        // Consider focus lost if mouse hasn't been in master for timeout period
        if (now - this.lastMouseCheckTime > this.MOUSE_FOCUS_TIMEOUT_MS) {
          this.isMouseInMaster = false;
        }
      }

      if (!this.syncOptions.enableMouseSync) return;
      if (!inMaster) return;

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
        try {
          this.windowManager.sendMouseEvent(slavePid, slavePos.x, slavePos.y, 'mousemove');
        } catch (error) {
          logger.error(`Failed to send mouse move event to slave ${slavePid}:`, error);
        }
      }
    } catch (error) {
      logger.error('Error in handleMouseMove:', error);
    }
  }

  /**
   * Handle mouse down events
   */
  private handleMouseDown(event: MouseEventData): void {
    try {
      if (!this.isCapturing || !this.masterWindowBounds) return;
      if (!this.syncOptions.enableMouseSync) return;

      const {x, y, button} = event;
      if (!this.isMouseInMasterWindow(x, y)) return;

      const ratio = this.calculateRelativePosition(x, y);
      if (!ratio) return;

      const eventType = button === 1 ? 'mousedown' : button === 2 ? 'rightdown' : 'mousedown';

      for (const [slavePid, slaveBounds] of this.slaveWindowBounds) {
        const slavePos = this.applyToSlaveWindow(ratio, slaveBounds);
        try {
          this.windowManager.sendMouseEvent(slavePid, slavePos.x, slavePos.y, eventType);
        } catch (error) {
          logger.error(`Failed to send mouse down event to slave ${slavePid}:`, error);
        }
      }
    } catch (error) {
      logger.error('Error in handleMouseDown:', error);
    }
  }

  /**
   * Handle mouse up events
   */
  private handleMouseUp(event: MouseEventData): void {
    try {
      if (!this.isCapturing || !this.masterWindowBounds) return;
      if (!this.syncOptions.enableMouseSync) return;

      const {x, y, button} = event;
      if (!this.isMouseInMasterWindow(x, y)) return;

      const ratio = this.calculateRelativePosition(x, y);
      if (!ratio) return;

      const eventType = button === 1 ? 'mouseup' : button === 2 ? 'rightup' : 'mouseup';

      for (const [slavePid, slaveBounds] of this.slaveWindowBounds) {
        const slavePos = this.applyToSlaveWindow(ratio, slaveBounds);
        try {
          this.windowManager.sendMouseEvent(slavePid, slavePos.x, slavePos.y, eventType);
        } catch (error) {
          logger.error(`Failed to send mouse up event to slave ${slavePid}:`, error);
        }
      }
    } catch (error) {
      logger.error('Error in handleMouseUp:', error);
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
    try {
      if (!this.isCapturing || !this.masterWindowBounds) {
        logger.debug('Wheel event skipped: not capturing or no master bounds');
        return;
      }
      if (!this.syncOptions.enableWheelSync) {
        logger.debug('Wheel event skipped: wheel sync disabled');
        return;
      }

      const now = Date.now();
      if (now - this.lastWheelTime < (this.syncOptions.wheelThrottleMs || 50)) {
        logger.debug('Wheel event throttled');
        return;
      }
      this.lastWheelTime = now;

      const {x, y, rotation, amount} = event;
      const inMaster = this.isMouseInMasterWindow(x, y);
      if (!inMaster) {
        logger.debug(`Wheel event skipped: mouse not in master (${x}, ${y})`);
        return;
      }

      logger.info('Processing wheel event', {x, y, rotation, amount, slavePids: Array.from(this.slaveWindowPids)});

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

      logger.info(`Sending wheel event to ${this.slaveWindowPids.size} slaves with deltaY=${deltaY}`);

      for (const slavePid of this.slaveWindowPids) {
        try {
          this.windowManager.sendWheelEvent(slavePid, 0, deltaY);
          logger.debug(`Wheel event sent to slave ${slavePid}`);
        } catch (error) {
          logger.error(`Failed to send wheel event to slave ${slavePid}:`, error);
        }
      }
    } catch (error) {
      logger.error('Error in handleWheel:', error);
    }
  }

  /**
   * Handle key down events
   * Only synchronizes when mouse is in master window (indicating user focus)
   */
  private handleKeyDown(event: KeyboardEventData): void {
    try {
      // Log complete event object to see all available fields
      logger.info('=== KEYDOWN EVENT DEBUG ===');
      logger.info('Full event object:', event);
      logger.info('Event as any:', (event as any));
      logger.info('All event keys:', Object.keys(event));
      logger.info('State:', {isCapturing: this.isCapturing, isMouseInMaster: this.isMouseInMaster});

      if (!this.isCapturing) {
        logger.debug('Keydown skipped: not capturing');
        return;
      }
      if (!this.syncOptions.enableKeyboardSync) {
        logger.debug('Keydown skipped: keyboard sync disabled');
        return;
      }

      // Only sync keyboard events when mouse is in master window
      // This prevents keyboard input from other windows being synchronized
      if (!this.isMouseInMaster) {
        logger.debug('Keydown skipped: mouse not in master');
        return;
      }

      // Validate window manager
      if (!this.windowManager) {
        logger.error('Window manager not initialized in handleKeyDown');
        return;
      }

      // Check all possible key code fields
      const eventAny = event as any;
      logger.info('Checking for key code fields:', {
        keycode: eventAny.keycode,
        rawcode: eventAny.rawcode,
        scancode: eventAny.scancode,
        code: eventAny.code,
        key: eventAny.key,
      });

      // Use keycode from uiohook-napi and convert to system keycode
      const {keycode: uiohookKeycode} = event;

      // Validate keycode
      if (uiohookKeycode === undefined || uiohookKeycode === null) {
        logger.warn('Invalid keycode in handleKeyDown:', uiohookKeycode);
        return;
      }

      // Convert uiohook keycode to system-native keycode
      const systemKeycode = convertKeyCode(uiohookKeycode);

      logger.info('Processing keydown', {
        uiohookKeycode,
        systemKeycode,
        platform: process.platform,
        slavePids: Array.from(this.slaveWindowPids)
      });

      logger.info(`Sending keydown to ${this.slaveWindowPids.size} slaves with systemKeycode=${systemKeycode}`);

      for (const slavePid of this.slaveWindowPids) {
        try {
          this.windowManager.sendKeyboardEvent(slavePid, systemKeycode, 'keydown');
          logger.debug(`Keydown sent to slave ${slavePid}`);
        } catch (error) {
          logger.error(`Failed to send keydown event to slave ${slavePid}:`, error);
        }
      }
    } catch (error) {
      logger.error('Error in handleKeyDown:', error);
    }
  }

  /**
   * Handle key up events
   * Only synchronizes when mouse is in master window (indicating user focus)
   */
  private handleKeyUp(event: KeyboardEventData): void {
    try {
      if (!this.isCapturing) {
        logger.debug('Keyup skipped: not capturing');
        return;
      }
      if (!this.syncOptions.enableKeyboardSync) {
        logger.debug('Keyup skipped: keyboard sync disabled');
        return;
      }

      // Only sync keyboard events when mouse is in master window
      // This prevents keyboard input from other windows being synchronized
      if (!this.isMouseInMaster) {
        logger.debug('Keyup skipped: mouse not in master');
        return;
      }

      // Validate window manager
      if (!this.windowManager) {
        logger.error('Window manager not initialized in handleKeyUp');
        return;
      }

      // Use keycode from uiohook-napi
      const {keycode: uiohookKeycode} = event;

      // Validate keycode
      if (uiohookKeycode === undefined || uiohookKeycode === null) {
        logger.warn('Invalid keycode in handleKeyUp:', uiohookKeycode);
        return;
      }

      // Convert uiohook keycode to system-native keycode
      const systemKeycode = convertKeyCode(uiohookKeycode);

      logger.info('Processing keyup', {
        uiohookKeycode,
        systemKeycode,
        platform: process.platform,
        slavePids: Array.from(this.slaveWindowPids)
      });

      for (const slavePid of this.slaveWindowPids) {
        try {
          this.windowManager.sendKeyboardEvent(slavePid, systemKeycode, 'keyup');
          logger.debug(`Keyup sent to slave ${slavePid} with systemKeycode=${systemKeycode}`);
        } catch (error) {
          logger.error(`Failed to send keyup event to slave ${slavePid}:`, error);
        }
      }
    } catch (error) {
      logger.error('Error in handleKeyUp:', error);
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
