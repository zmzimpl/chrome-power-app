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
  keycode: number; // uiohook-napi virtual keycode
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

// uiohook-napi keycode to Windows Virtual-Key Code mapping
// Based on libuiohook keycodes: https://github.com/kwhat/libuiohook/blob/master/include/uiohook.h
const UIOHOOK_TO_WINDOWS_VK: Record<number, number> = {
  // Letters (A-Z)
  30: 0x41, // A
  48: 0x42, // B
  46: 0x43, // C
  32: 0x44, // D
  18: 0x45, // E
  33: 0x46, // F
  34: 0x47, // G
  35: 0x48, // H
  23: 0x49, // I
  36: 0x4A, // J
  37: 0x4B, // K
  38: 0x4C, // L
  50: 0x4D, // M
  49: 0x4E, // N
  24: 0x4F, // O
  25: 0x50, // P
  16: 0x51, // Q
  19: 0x52, // R
  31: 0x53, // S
  20: 0x54, // T
  22: 0x55, // U
  47: 0x56, // V
  17: 0x57, // W
  45: 0x58, // X
  21: 0x59, // Y
  44: 0x5A, // Z

  // Numbers (0-9)
  11: 0x30, // 0
  2: 0x31,  // 1
  3: 0x32,  // 2
  4: 0x33,  // 3
  5: 0x34,  // 4
  6: 0x35,  // 5
  7: 0x36,  // 6
  8: 0x37,  // 7
  9: 0x38,  // 8
  10: 0x39, // 9

  // Punctuation marks
  12: 0xBD,  // Minus (-)
  13: 0xBB,  // Equals (=)
  26: 0xDB,  // Open Bracket ([)
  27: 0xDD,  // Close Bracket (])
  43: 0xDC,  // Backslash (\)
  39: 0xBA,  // Semicolon (;)
  40: 0xDE,  // Quote (')
  51: 0xBC,  // Comma (,)
  52: 0xBE,  // Period (.)
  53: 0xBF,  // Slash (/)
  41: 0xC0,  // Backquote (`)

  // Numpad numbers
  82: 0x60,  // Numpad 0
  79: 0x61,  // Numpad 1
  80: 0x62,  // Numpad 2
  81: 0x63,  // Numpad 3
  75: 0x64,  // Numpad 4
  76: 0x65,  // Numpad 5
  77: 0x66,  // Numpad 6
  71: 0x67,  // Numpad 7
  72: 0x68,  // Numpad 8
  73: 0x69,  // Numpad 9

  // Numpad operators
  55: 0x6A,    // Numpad Multiply (*)
  78: 0x6B,    // Numpad Add (+)
  83: 0x6C,    // Numpad Separator
  74: 0x6D,    // Numpad Subtract (-)
  3637: 0x6F,  // Numpad Divide (/) - 0x0E35
  3612: 0x0D,  // Numpad Enter - 0x0E1C (same as regular Enter)

  // Common keys
  57: 0x20,   // Space
  28: 0x0D,   // Enter
  14: 0x08,   // Backspace
  15: 0x09,   // Tab
  1: 0x1B,    // Escape
  58: 0x14,   // Caps Lock
  42: 0x10,   // Left Shift
  54: 0x10,   // Right Shift
  29: 0x11,   // Left Ctrl
  97: 0x11,   // Right Ctrl (0x001D with extended bit)
  56: 0x12,   // Left Alt
  100: 0x12,  // Right Alt (0x0038 with extended bit)

  // Arrow keys (extended keys - 0xE0xx)
  57416: 0x26, // Up (0xE048)
  57424: 0x28, // Down (0xE050)
  57419: 0x25, // Left (0xE04B)
  57421: 0x27, // Right (0xE04D)

  // Edit keys
  57427: 0x2E,   // Delete (0xE053)
  57426: 0x2D,   // Insert (0xE052)
  57415: 0x24,   // Home (0xE047)
  57423: 0x23,   // End (0xE04F)
  57417: 0x21,   // Page Up (0xE049)
  57425: 0x22,   // Page Down (0xE051)

  // Function keys
  59: 0x70,  // F1
  60: 0x71,  // F2
  61: 0x72,  // F3
  62: 0x73,  // F4
  63: 0x74,  // F5
  64: 0x75,  // F6
  65: 0x76,  // F7
  66: 0x77,  // F8
  67: 0x78,  // F9
  68: 0x79,  // F10
  87: 0x7A,  // F11
  88: 0x7B,  // F12
};

// uiohook-napi keycode to macOS CGKeyCode mapping
const UIOHOOK_TO_MACOS_CGKEY: Record<number, number> = {
  // Letters (A-Z) - QWERTY layout
  30: 0,   // A
  48: 11,  // B
  46: 8,   // C
  32: 2,   // D
  18: 14,  // E
  33: 3,   // F
  34: 5,   // G
  35: 4,   // H
  23: 34,  // I
  36: 38,  // J
  37: 40,  // K
  38: 37,  // L
  50: 46,  // M
  49: 45,  // N
  24: 31,  // O
  25: 35,  // P
  16: 12,  // Q
  19: 15,  // R
  31: 1,   // S
  20: 17,  // T
  22: 32,  // U
  47: 9,   // V
  17: 13,  // W
  45: 7,   // X
  21: 16,  // Y
  44: 6,   // Z

  // Numbers (0-9)
  11: 29,  // 0
  2: 18,   // 1
  3: 19,   // 2
  4: 20,   // 3
  5: 21,   // 4
  6: 23,   // 5
  7: 22,   // 6
  8: 26,   // 7
  9: 28,   // 8
  10: 25,  // 9

  // Punctuation marks
  12: 27,  // Minus (-)
  13: 24,  // Equals (=)
  26: 33,  // Open Bracket ([)
  27: 30,  // Close Bracket (])
  43: 42,  // Backslash (\)
  39: 41,  // Semicolon (;)
  40: 39,  // Quote (')
  51: 43,  // Comma (,)
  52: 47,  // Period (.)
  53: 44,  // Slash (/)
  41: 50,  // Backquote (`)

  // Numpad numbers
  82: 82,  // Numpad 0
  79: 83,  // Numpad 1
  80: 84,  // Numpad 2
  81: 85,  // Numpad 3
  75: 86,  // Numpad 4
  76: 87,  // Numpad 5
  77: 88,  // Numpad 6
  71: 89,  // Numpad 7
  72: 91,  // Numpad 8
  73: 92,  // Numpad 9

  // Numpad operators
  55: 67,    // Numpad Multiply (*)
  78: 69,    // Numpad Add (+)
  83: 65,    // Numpad Decimal/Separator
  74: 78,    // Numpad Subtract (-)
  3637: 75,  // Numpad Divide (/)
  3612: 76,  // Numpad Enter

  // Common keys
  57: 49,   // Space
  28: 36,   // Enter
  14: 51,   // Backspace
  15: 48,   // Tab
  1: 53,    // Escape
  58: 57,   // Caps Lock
  42: 56,   // Left Shift
  54: 60,   // Right Shift
  29: 59,   // Left Ctrl
  56: 58,   // Left Alt/Option
  100: 61,  // Right Alt/Option

  // Arrow keys
  57416: 126, // Up
  57424: 125, // Down
  57419: 123, // Left
  57421: 124, // Right

  // Edit keys
  57427: 117,  // Delete (Forward Delete)
  57426: 114,  // Insert/Help
  57415: 115,  // Home
  57423: 119,  // End
  57417: 116,  // Page Up
  57425: 121,  // Page Down

  // Function keys
  59: 122,  // F1
  60: 120,  // F2
  61: 99,   // F3
  62: 118,  // F4
  63: 96,   // F5
  64: 97,   // F6
  65: 98,   // F7
  66: 100,  // F8
  67: 101,  // F9
  68: 109,  // F10
  87: 103,  // F11
  88: 111,  // F12
};

/**
 * Convert uiohook keycode to system-native keycode
 */
function convertKeyCode(uiohookKeycode: number): number {
  if (process.platform === 'win32') {
    const vkCode = UIOHOOK_TO_WINDOWS_VK[uiohookKeycode];
    if (vkCode !== undefined) {
      return vkCode;
    }
  } else if (process.platform === 'darwin') {
    const cgKeyCode = UIOHOOK_TO_MACOS_CGKEY[uiohookKeycode];
    if (cgKeyCode !== undefined) {
      return cgKeyCode;
    }
  }

  // Fallback: return original keycode
  logger.warn(`No keycode mapping found for uiohook keycode ${uiohookKeycode} on platform ${process.platform}`);
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
  logger.info('uiohook-napi loaded successfully');
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

  // Keyboard event deduplication
  private lastKeyEvent: {keycode: number; type: 'keydown' | 'keyup'; time: number} | null = null;
  private readonly KEY_DEDUP_THRESHOLD_MS = 20; // Ignore duplicate events within 20ms

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

      // Get keycode from uiohook-napi
      const {keycode} = event;

      // Validate keycode
      if (keycode === undefined || keycode === null) {
        logger.warn('Invalid keycode in handleKeyDown:', keycode);
        return;
      }

      // Deduplication: Check if this is a duplicate event
      const now = Date.now();
      if (this.lastKeyEvent &&
          this.lastKeyEvent.keycode === keycode &&
          this.lastKeyEvent.type === 'keydown' &&
          now - this.lastKeyEvent.time < this.KEY_DEDUP_THRESHOLD_MS) {
        logger.debug('Duplicate keydown event ignored', {keycode, timeSinceLast: now - this.lastKeyEvent.time});
        return;
      }

      // Update last key event
      this.lastKeyEvent = {keycode, type: 'keydown', time: now};

      // Convert to system-native keycode
      const nativeKeycode = convertKeyCode(keycode);

      logger.debug('Keydown', {
        uiohookKeycode: keycode,
        nativeKeycode,
        platform: process.platform
      });

      // Send to slave windows
      for (const slavePid of this.slaveWindowPids) {
        try {
          this.windowManager.sendKeyboardEvent(slavePid, nativeKeycode, 'keydown');
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

      // Get keycode from uiohook-napi
      const {keycode} = event;

      // Validate keycode
      if (keycode === undefined || keycode === null) {
        logger.warn('Invalid keycode in handleKeyUp:', keycode);
        return;
      }

      // Deduplication: Check if this is a duplicate event
      const now = Date.now();
      if (this.lastKeyEvent &&
          this.lastKeyEvent.keycode === keycode &&
          this.lastKeyEvent.type === 'keyup' &&
          now - this.lastKeyEvent.time < this.KEY_DEDUP_THRESHOLD_MS) {
        logger.debug('Duplicate keyup event ignored', {keycode, timeSinceLast: now - this.lastKeyEvent.time});
        return;
      }

      // Update last key event
      this.lastKeyEvent = {keycode, type: 'keyup', time: now};

      // Convert to system-native keycode
      const nativeKeycode = convertKeyCode(keycode);

      logger.debug('Keyup', {
        uiohookKeycode: keycode,
        nativeKeycode
      });

      // Send to slave windows
      for (const slavePid of this.slaveWindowPids) {
        try {
          this.windowManager.sendKeyboardEvent(slavePid, nativeKeycode, 'keyup');
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
