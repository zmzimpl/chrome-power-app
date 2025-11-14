import {ipcMain, app} from 'electron';
import path from 'path';
import type {SafeAny} from '../../../shared/types/db';
import {createLogger} from '../../../shared/utils/logger';
import {SERVICE_LOGGER_LABEL} from '../constants';
import {WindowDB} from '../db/window';
import puppeteer, {type Browser} from 'puppeteer';

const logger = createLogger(SERVICE_LOGGER_LABEL);

// Environment check
const isDevelopment = process.env.NODE_ENV !== 'production';

// Conditional logging helper - only log sync operations in development
const devLogger = {
  debug: (message: string, ...meta: SafeAny[]) => {
    if (isDevelopment) {
      logger.debug(message, ...meta);
    }
  },
  info: (message: string, ...meta: SafeAny[]) => {
    if (isDevelopment) {
      logger.info(message, ...meta);
    }
  },
  warn: (message: string, ...meta: SafeAny[]) => {
    // Always log warnings
    logger.warn(message, ...meta);
  },
  error: (message: string, ...meta: SafeAny[]) => {
    // Always log errors
    logger.error(message, ...meta);
  },
};

// Types for events
interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  pid: number;
}

interface MouseEventData {
  x: number;
  y: number;
  button: number;
  clicks: number;
}

interface KeyboardEventData {
  keycode?: number; // @tkomde/iohook virtual keycode (fallback)
  rawcode?: number; // @tkomde/iohook native OS keycode (preferred)
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

interface SyncOptions {
  enableMouseSync?: boolean;
  enableKeyboardSync?: boolean;
  enableWheelSync?: boolean;
  enableCdpSync?: boolean; // Enable CDP-based synchronization
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

// Load @tkomde/iohook
let uIOhook: SafeAny;
try {
  const iohook = require('@tkomde/iohook');
  uIOhook = iohook;
  // Enable rawcode mode to get native OS keycodes directly
  if (typeof iohook.useRawcode === 'function') {
    iohook.useRawcode(true);
    logger.info('@tkomde/iohook loaded successfully with rawcode enabled');
  } else {
    logger.info('@tkomde/iohook loaded successfully (rawcode mode not available)');
  }
} catch (error) {
  logger.error('Failed to load @tkomde/iohook:', error);
}

class MultiWindowSyncService {
  private masterWindowPid: number | null = null;
  private slaveWindowPids: Set<number> = new Set();
  private masterWindowBounds: WindowBounds | null = null;
  private slaveWindowBounds: Map<number, WindowBounds> = new Map();
  private isCapturing: boolean = false;
  private windowManager: SafeAny = null;

  // Mouse position tracking - used for popup window detection in keyboard/mouse events
  private lastMouseX: number = 0;
  private lastMouseY: number = 0;

  // Sync options
  private syncOptions: SyncOptions = {
    enableMouseSync: true,
    enableKeyboardSync: true,
    enableWheelSync: true,
    enableCdpSync: false, // Disabled by default
    wheelThrottleMs: 50,
    cdpSyncIntervalMs: 100,
  };

  // CDP connections
  private cdpBrowsers: Map<number, Browser> = new Map();
  private cdpSyncInterval: NodeJS.Timeout | null = null;
  private lastScrollPosition: {x: number; y: number} = {x: 0, y: 0};

  // Wheel event throttling and accumulation
  private lastWheelTime: number = 0;
  private accumulatedWheelRotation: number = 0;
  private wheelAccumulationTimer: NodeJS.Timeout | null = null;

  // Keyboard event deduplication
  private lastKeyEvent: {keycode: number; type: 'keydown' | 'keyup'; time: number} | null = null;
  private readonly KEY_DEDUP_THRESHOLD_MS = 20; // Ignore duplicate events within 20ms (for accidental duplicates)
  // Key repeat (holding key down) typically happens every 30-33ms, so we use 20ms threshold
  private keyEventCounter: number = 0; // Counter to track event frequency

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
        return {success: false, error: '@tkomde/iohook not loaded'};
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
      await this.stopCdpSync();

      // Clear wheel accumulation timer
      if (this.wheelAccumulationTimer) {
        clearTimeout(this.wheelAccumulationTimer);
        this.wheelAccumulationTimer = null;
      }
      this.accumulatedWheelRotation = 0;

      this.isCapturing = false;
      this.masterWindowPid = null;
      this.slaveWindowPids.clear();
      this.masterWindowBounds = null;
      this.slaveWindowBounds.clear();

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

    // Remove any existing listeners first to prevent duplicates
    this.removeEventListeners();

    logger.info('Setting up event listeners for @tkomde/iohook...');

    // mousemove listener is used only for focus tracking (keyboard sync)
    // Actual mouse position sync is done only before clicks/scrolls for performance
    uIOhook.on('mousemove', this.handleMouseMove.bind(this));
    logger.debug('✓ mousemove listener registered (focus tracking only, no sync)');

    uIOhook.on('mousedown', this.handleMouseDown.bind(this));
    logger.debug('✓ mousedown listener registered');

    uIOhook.on('mouseup', this.handleMouseUp.bind(this));
    logger.debug('✓ mouseup listener registered');

    uIOhook.on('mousewheel', this.handleWheel.bind(this));
    logger.debug('✓ mousewheel listener registered');

    // Only listen to keydown and synthesize complete key press (down + up)
    uIOhook.on('keydown', this.handleKeyDown.bind(this));
    logger.debug('✓ keydown listener registered');
    // Note: keyup listener removed to prevent duplicate input

    // Add a test listener to see if ANY events are firing
    uIOhook.on('input', (event: SafeAny) => {
      devLogger.info('🔍 Generic input event received:', {
        type: event.type,
        keys: Object.keys(event),
      });
    });

    logger.info('Event listeners setup complete (keyup listener disabled to prevent duplicates)');
    logger.info('Wheel sync enabled:', this.syncOptions.enableWheelSync);
  }

  /**
   * Remove event listeners
   */
  private removeEventListeners(): void {
    if (!uIOhook) return;

    uIOhook.removeAllListeners('mousemove');
    uIOhook.removeAllListeners('mousedown');
    uIOhook.removeAllListeners('mouseup');
    uIOhook.removeAllListeners('mousewheel');
    uIOhook.removeAllListeners('keydown');
    uIOhook.removeAllListeners('keyup');
    uIOhook.removeAllListeners('input');
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
   * Check if mouse is within master window OR its extension windows
   * Returns true if mouse should trigger synchronization
   */
  private isMouseInMasterOrExtension(x: number, y: number): boolean {
    // First check main window
    if (this.isMouseInMasterWindow(x, y)) {
      return true;
    }

    // Then check extension windows
    try {
      const masterWindows = this.windowManager.getAllWindows(this.masterWindowPid);
      for (const win of masterWindows) {
        if (win.isExtension) {
          if (x >= win.x && x <= win.x + win.width &&
              y >= win.y && y <= win.y + win.height) {
            return true;
          }
        }
      }
    } catch (error) {
      // Silently fail if getAllWindows not available
    }

    return false;
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
   * Tracks mouse position for popup detection - no position synchronization
   * Position sync happens only before clicks/scrolls for performance
   */
  private handleMouseMove(event: MouseEventData): void {
    try {
      if (!this.isCapturing || !this.masterWindowBounds) return;

      const {x, y} = event;

      // Track mouse position for popup detection in keyboard/mouse events
      this.lastMouseX = x;
      this.lastMouseY = y;

      // Note: Mouse position is NOT continuously synced for performance
      // Position sync happens only before clicks/scrolls (see handleMouseDown, handleWheel)
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

      // Check if master window is active (foreground)
      if (!this.windowManager.isProcessWindowActive(this.masterWindowPid)) {
        devLogger.debug('Master window not active - skipping mouse event');
        return;
      }

      // Check if mouse is within master window OR its extension windows
      if (!this.isMouseInMasterOrExtension(x, y)) {
        devLogger.debug('Mouse not in master window or extension - skipping');
        return;
      }

      const eventType = button === 1 ? 'mousedown' : button === 2 ? 'rightdown' : 'mousedown';

      devLogger.info(`🖱️ Mouse ${eventType} at (${x}, ${y}), button=${button}, slaves=${this.slaveWindowPids.size}`);

      // Check if mouse is in master extension window
      let inMasterExtension = false;
      let masterExtensionBounds: {x: number; y: number; width: number; height: number} | null = null;

      try {
        const masterWindows = this.windowManager.getAllWindows(this.masterWindowPid);
        for (const win of masterWindows) {
          if (win.isExtension && x >= win.x && x <= win.x + win.width &&
              y >= win.y && y <= win.y + win.height) {
            inMasterExtension = true;
            masterExtensionBounds = {x: win.x, y: win.y, width: win.width, height: win.height};
            devLogger.debug(`🖱️ Mouse in master extension window: "${win.title}"`);
            break;
          }
        }
      } catch (error) {
        logger.error('Failed to check master extension windows:', error);
      }

      if (inMasterExtension && masterExtensionBounds) {
        // Mouse is in extension window - route to slave extension windows
        const relX = (x - masterExtensionBounds.x) / masterExtensionBounds.width;
        const relY = (y - masterExtensionBounds.y) / masterExtensionBounds.height;

        for (const slavePid of this.slaveWindowPids) {
          try {
            const slaveWindows = this.windowManager.getAllWindows(slavePid);
            for (const win of slaveWindows) {
              if (win.isExtension) {
                // Apply relative position to slave extension window
                const slaveX = Math.floor(win.x + relX * win.width);
                const slaveY = Math.floor(win.y + relY * win.height);

                devLogger.debug(`→ Sending ${eventType} to slave ${slavePid} extension at (${slaveX}, ${slaveY})`);

                this.windowManager.sendMouseEvent(slavePid, slaveX, slaveY, 'mousemove');
                setTimeout(() => {
                  try {
                    this.windowManager.sendMouseEvent(slavePid, slaveX, slaveY, eventType);
                  } catch (error) {
                    logger.error(`Failed to send ${eventType} to slave ${slavePid}:`, error);
                  }
                }, 10);
                break;
              }
            }
          } catch (error) {
            logger.error(`Failed to send mouse event to slave ${slavePid} extension:`, error);
          }
        }
      } else {
        // Mouse is in main window - use existing logic
        const ratio = this.calculateRelativePosition(x, y);
        if (!ratio) return;

        for (const [slavePid, slaveBounds] of this.slaveWindowBounds) {
          const slavePos = this.applyToSlaveWindow(ratio, slaveBounds);
          try {
            this.windowManager.sendMouseEvent(slavePid, slavePos.x, slavePos.y, 'mousemove');

            setTimeout(() => {
              try {
                this.windowManager.sendMouseEvent(slavePid, slavePos.x, slavePos.y, eventType);
                devLogger.debug(`→ Sent ${eventType} to slave ${slavePid} at (${slavePos.x}, ${slavePos.y})`);
              } catch (error) {
                logger.error(`Failed to send ${eventType} to slave ${slavePid}:`, error);
              }
            }, 10);
          } catch (error) {
            logger.error(`Failed to send mouse down event to slave ${slavePid}:`, error);
          }
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

      // Check if master window is active (foreground)
      if (!this.windowManager.isProcessWindowActive(this.masterWindowPid)) {
        devLogger.debug('Master window not active - skipping mouse event');
        return;
      }

      // Check if mouse is within master window OR its extension windows
      if (!this.isMouseInMasterOrExtension(x, y)) {
        devLogger.debug('Mouse not in master window or extension - skipping');
        return;
      }

      const eventType = button === 1 ? 'mouseup' : button === 2 ? 'rightup' : 'mouseup';

      devLogger.info(`🖱️ Mouse ${eventType} at (${x}, ${y}), button=${button}, slaves=${this.slaveWindowPids.size}`);

      // Check if mouse is in master extension window
      let inMasterExtension = false;
      let masterExtensionBounds: {x: number; y: number; width: number; height: number} | null = null;

      try {
        const masterWindows = this.windowManager.getAllWindows(this.masterWindowPid);
        for (const win of masterWindows) {
          if (win.isExtension && x >= win.x && x <= win.x + win.width &&
              y >= win.y && y <= win.y + win.height) {
            inMasterExtension = true;
            masterExtensionBounds = {x: win.x, y: win.y, width: win.width, height: win.height};
            break;
          }
        }
      } catch (error) {
        logger.error('Failed to check master extension windows:', error);
      }

      if (inMasterExtension && masterExtensionBounds) {
        // Mouse is in extension window - route to slave extension windows
        const relX = (x - masterExtensionBounds.x) / masterExtensionBounds.width;
        const relY = (y - masterExtensionBounds.y) / masterExtensionBounds.height;

        for (const slavePid of this.slaveWindowPids) {
          try {
            const slaveWindows = this.windowManager.getAllWindows(slavePid);
            for (const win of slaveWindows) {
              if (win.isExtension) {
                const slaveX = Math.floor(win.x + relX * win.width);
                const slaveY = Math.floor(win.y + relY * win.height);

                devLogger.debug(`→ Sending ${eventType} to slave ${slavePid} extension at (${slaveX}, ${slaveY})`);
                this.windowManager.sendMouseEvent(slavePid, slaveX, slaveY, eventType);
                break;
              }
            }
          } catch (error) {
            logger.error(`Failed to send mouse event to slave ${slavePid} extension:`, error);
          }
        }
      } else {
        // Mouse is in main window - use existing logic
        const ratio = this.calculateRelativePosition(x, y);
        if (!ratio) return;

        for (const [slavePid, slaveBounds] of this.slaveWindowBounds) {
          const slavePos = this.applyToSlaveWindow(ratio, slaveBounds);
          try {
            devLogger.debug(`→ Sending ${eventType} to slave ${slavePid} at (${slavePos.x}, ${slavePos.y})`);
            this.windowManager.sendMouseEvent(slavePid, slavePos.x, slavePos.y, eventType);
          } catch (error) {
            logger.error(`Failed to send mouse up event to slave ${slavePid}:`, error);
          }
        }
      }
    } catch (error) {
      logger.error('Error in handleMouseUp:', error);
    }
  }

  /**
   * Handle wheel events (with accumulation to prevent loss during fast scrolling)
   * @tkomde/iohook wheel event structure:
   * - rotation: scroll amount with direction (positive = scroll down, negative = scroll up)
   * - amount: absolute scroll amount (always positive)
   * - direction: 3 for vertical, 4 for horizontal
   * - x, y: mouse position
   */
  private handleWheel(event: WheelEventData): void {
    try {
      if (!this.isCapturing || !this.masterWindowBounds) {
        return;
      }
      if (!this.syncOptions.enableWheelSync) {
        return;
      }

      const {x, y, rotation, direction} = event;

      // Check if mouse is within master window OR its extension windows
      if (!this.isMouseInMasterOrExtension(x, y)) {
        return;
      }

      // Skip horizontal scrolling for now (can be added later if needed)
      if (direction === 4) {
        return;
      }

      // Accumulate rotation to prevent loss during fast scrolling
      this.accumulatedWheelRotation += rotation;

      // Clear existing timer and schedule new one
      if (this.wheelAccumulationTimer) {
        clearTimeout(this.wheelAccumulationTimer);
      }

      // Store current mouse position for sending
      const currentX = x;
      const currentY = y;

      // Schedule sending accumulated scroll after 16ms (~60fps)
      // This ensures we don't lose scroll events during fast scrolling
      this.wheelAccumulationTimer = setTimeout(() => {
        this.sendAccumulatedWheelEvent(currentX, currentY);
      }, 16);
    } catch (error) {
      logger.error('Error in handleWheel:', error);
    }
  }

  /**
   * Send accumulated wheel events to slave windows
   */
  private sendAccumulatedWheelEvent(x: number, y: number): void {
    try {
      const rotation = this.accumulatedWheelRotation;

      // Reset accumulation
      this.accumulatedWheelRotation = 0;
      this.wheelAccumulationTimer = null;

      if (rotation === 0) {
        return;
      }

      // Calculate deltaY from accumulated rotation
      // rotation is positive for scroll down, negative for scroll up
      // Windows expects negative values for scroll down
      const deltaY = Math.round(-rotation * 120); // Standard wheel delta is 120 units per notch

      devLogger.info(`Sending wheel event: deltaY=${deltaY} (rotation=${rotation})`);

      // Check if mouse is in master extension window
      let inMasterExtension = false;
      let masterExtensionBounds: {x: number; y: number; width: number; height: number} | null = null;

      try {
        const masterWindows = this.windowManager.getAllWindows(this.masterWindowPid);
        for (const win of masterWindows) {
          if (win.isExtension && x >= win.x && x <= win.x + win.width &&
              y >= win.y && y <= win.y + win.height) {
            inMasterExtension = true;
            masterExtensionBounds = {x: win.x, y: win.y, width: win.width, height: win.height};
            break;
          }
        }
      } catch (error) {
        logger.error('Failed to check master extension windows:', error);
      }

      if (inMasterExtension && masterExtensionBounds) {
        // Mouse is in extension window - route to slave extension windows
        const relX = (x - masterExtensionBounds.x) / masterExtensionBounds.width;
        const relY = (y - masterExtensionBounds.y) / masterExtensionBounds.height;

        for (const slavePid of this.slaveWindowPids) {
          try {
            const slaveWindows = this.windowManager.getAllWindows(slavePid);
            for (const win of slaveWindows) {
              if (win.isExtension) {
                const slaveX = Math.floor(win.x + relX * win.width);
                const slaveY = Math.floor(win.y + relY * win.height);

                this.windowManager.sendWheelEvent(slavePid, 0, deltaY, slaveX, slaveY);
                break;
              }
            }
          } catch (error) {
            logger.error(`Failed to send wheel event to slave ${slavePid} extension:`, error);
          }
        }
      } else {
        // Mouse is in main window - use existing logic
        const ratio = this.calculateRelativePosition(x, y);
        if (!ratio) {
          logger.warn('Failed to calculate relative position for wheel event');
          return;
        }

        for (const [slavePid, slaveBounds] of this.slaveWindowBounds) {
          const slavePos = this.applyToSlaveWindow(ratio, slaveBounds);
          try {
            this.windowManager.sendWheelEvent(slavePid, 0, deltaY, slavePos.x, slavePos.y);
          } catch (error) {
            logger.error(`Failed to send wheel event to slave ${slavePid}:`, error);
          }
        }
      }
    } catch (error) {
      logger.error('Error in sendAccumulatedWheelEvent:', error);
    }
  }

  /**
   * Check if keyboard event should be ignored (not synchronized)
   * Filters out common shortcuts that should only execute on master window
   */
  private shouldIgnoreKeyboardEvent(event: KeyboardEventData, nativeKeycode: number): boolean {
    const {ctrlKey, altKey, shiftKey} = event;

    // Filter Ctrl+C (Copy) - most important
    if (ctrlKey && nativeKeycode === 67) {
      devLogger.info('🚫 Ignoring Ctrl+C (Copy) - not syncing to slaves');
      return true;
    }

    // Filter other common shortcuts
    if (ctrlKey && !altKey && !shiftKey) {
      const ignoredKeycodes: {[key: number]: string} = {
        88: 'Ctrl+X (Cut)',
      };

      if (nativeKeycode in ignoredKeycodes) {
        devLogger.info(`🚫 Ignoring ${ignoredKeycodes[nativeKeycode]} - not syncing to slaves`);
        return true;
      }
    }

    return false;
  }

  /**
   * Handle key down events
   * Only synchronizes when master window is active (using PID-based detection)
   */
  private handleKeyDown(event: KeyboardEventData): void {
    try {
      // Log complete event object to see all available fields
      if (!this.isCapturing) {
        return;
      }
      if (!this.syncOptions.enableKeyboardSync) {
        return;
      }

      // Validate window manager
      if (!this.windowManager) {
        logger.error('Window manager not initialized in handleKeyDown');
        return;
      }

      // Only sync keyboard events when master window is the active foreground window
      // This is more accurate than mouse position checking
      if (!this.windowManager.isProcessWindowActive(this.masterWindowPid)) {
        devLogger.debug('Keydown skipped: master window not active');
        return;
      }

      // Get rawcode (native OS keycode) from @tkomde/iohook
      // rawcode is the preferred field when useRawcode(true) is enabled
      const {keycode, rawcode} = event;

      // Use rawcode if available (native OS keycode), otherwise fallback to keycode
      const nativeKeycode = rawcode ?? keycode;

      // Validate keycode
      if (nativeKeycode === undefined || nativeKeycode === null) {
        logger.warn('Invalid keycode/rawcode in handleKeyDown:', {keycode, rawcode});
        return;
      }

      // Filter out common shortcuts that should not be synchronized
      if (this.shouldIgnoreKeyboardEvent(event, nativeKeycode)) {
        return;
      }

      // DEBUG: Log complete event object
      devLogger.info('🔍 DEBUG: Complete keyboard event', {
        keycode,
        rawcode,
        nativeKeycode,
        allEventFields: Object.keys(event),
        fullEvent: event,
      });

      // Increment event counter
      this.keyEventCounter++;

      // Deduplication: Check if this is a duplicate event
      const now = Date.now();
      const isDuplicate = this.lastKeyEvent &&
          this.lastKeyEvent.keycode === nativeKeycode &&
          this.lastKeyEvent.type === 'keydown' &&
          now - this.lastKeyEvent.time < this.KEY_DEDUP_THRESHOLD_MS;

      if (isDuplicate) {
        logger.warn('⚠️  DUPLICATE keydown detected and ignored', {
          nativeKeycode,
          timeSinceLast: now - this.lastKeyEvent!.time,
          threshold: this.KEY_DEDUP_THRESHOLD_MS,
          eventCounter: this.keyEventCounter,
        });
        return;
      }

      // Update last key event
      this.lastKeyEvent = {keycode: nativeKeycode, type: 'keydown', time: now};

      // First check if mouse is in master window's popup using master PID
      // This tells us if we should route to slave popups or main windows
      let inMasterPopup = false;
      let masterPopupInfo = null;

      try {
        // Check if getAllWindows method exists
        if (typeof this.windowManager.getAllWindows !== 'function') {
          logger.error('❌ getAllWindows method not found! Native addon needs rebuild.');
          logger.error('Available methods:', Object.keys(this.windowManager));
        } else {
          const masterPopups = this.windowManager.getAllWindows(this.masterWindowPid);
          devLogger.debug(`🔍 Master PID ${this.masterWindowPid} has ${masterPopups.length} windows`);

          for (const win of masterPopups) {
            devLogger.debug(`  Window: isExtension=${win.isExtension}, bounds=[${win.x}, ${win.y}, ${win.width}, ${win.height}], title="${win.title || 'unknown'}"`);

            if (win.isExtension) {
              const {x: wx, y: wy, width, height} = win;
              const inBounds = this.lastMouseX >= wx &&
                              this.lastMouseX <= wx + width &&
                              this.lastMouseY >= wy &&
                              this.lastMouseY <= wy + height;

              devLogger.debug(`    Mouse (${this.lastMouseX}, ${this.lastMouseY}) in popup bounds? ${inBounds}`);

              if (inBounds) {
                inMasterPopup = true;
                masterPopupInfo = {
                  title: win.title,
                  bounds: {x: wx, y: wy, width, height},
                };
                devLogger.info(`✅ Mouse in MASTER popup: "${win.title || 'unknown'}"`);
                break;
              }
            }
          }

          if (!inMasterPopup) {
            devLogger.debug('❌ Mouse NOT in any master popup');
          }
        }
      } catch (error) {
        logger.error('Failed to check master popup:', error);
      }

      devLogger.info('⌨️  Key press', {
        eventCounter: this.keyEventCounter,
        rawcode,
        keycode,
        nativeKeycode,
        slaveCount: this.slaveWindowPids.size,
        mousePosition: `(${this.lastMouseX}, ${this.lastMouseY})`,
        inMasterPopup,
      });

      // Send complete key press to slave windows (keydown + keyup)
      for (const slavePid of this.slaveWindowPids) {
        try {
          if (inMasterPopup && masterPopupInfo) {
            // User is in master popup, calculate relative position
            const masterBounds = masterPopupInfo.bounds;
            const relX = (this.lastMouseX - masterBounds.x) / masterBounds.width;
            const relY = (this.lastMouseY - masterBounds.y) / masterBounds.height;

            const slavePopups = this.windowManager.getAllWindows(slavePid);
            devLogger.debug(`🔍 Slave PID ${slavePid} has ${slavePopups.length} windows`);

            let sentToPopup = false;

            for (const win of slavePopups) {
              devLogger.debug(`  Slave window: isExtension=${win.isExtension}, bounds=[${win.x}, ${win.y}, ${win.width}, ${win.height}], title="${win.title || 'unknown'}"`);

              if (win.isExtension) {
                // Apply relative position to slave extension window
                const slaveX = Math.floor(win.x + relX * win.width);
                const slaveY = Math.floor(win.y + relY * win.height);

                devLogger.info(`  ✅ Routing to slave ${slavePid} popup "${win.title}" at (${slaveX}, ${slaveY}) [rel: ${(relX*100).toFixed(1)}%, ${(relY*100).toFixed(1)}%]`);

                this.windowManager.sendKeyboardEvent(slavePid, nativeKeycode, 'keydown', slaveX, slaveY);
                setTimeout(() => {
                  try {
                    this.windowManager.sendKeyboardEvent(slavePid, nativeKeycode, 'keyup', slaveX, slaveY);
                  } catch (error) {
                    logger.error(`Failed to send keyup to slave ${slavePid}:`, error);
                  }
                }, 10);

                sentToPopup = true;
                break;
              }
            }

            if (!sentToPopup) {
              logger.warn(`⚠️  Slave ${slavePid} has no extension window, fallback to main window`);
              // Fallback to main window
              this.windowManager.sendKeyboardEvent(slavePid, nativeKeycode, 'keydown', -1, -1);
              setTimeout(() => {
                try {
                  this.windowManager.sendKeyboardEvent(slavePid, nativeKeycode, 'keyup', -1, -1);
                } catch (error) {
                  logger.error(`Failed to send keyup to slave ${slavePid}:`, error);
                }
              }, 10);
            }
          } else {
            // User is in main window (may include browser-internal popups)
            // Send with mouse coordinates so keyboard events are routed correctly
            const slaveBounds = this.slaveWindowBounds.get(slavePid);

            if (slaveBounds && this.masterWindowBounds) {
              // Calculate relative position in master window
              const relX = (this.lastMouseX - this.masterWindowBounds.x) / this.masterWindowBounds.width;
              const relY = (this.lastMouseY - this.masterWindowBounds.y) / this.masterWindowBounds.height;

              // Apply to slave window
              const slaveX = Math.floor(slaveBounds.x + relX * slaveBounds.width);
              const slaveY = Math.floor(slaveBounds.y + relY * slaveBounds.height);

              devLogger.debug(`  → Sending key press to slave ${slavePid} main window at (${slaveX}, ${slaveY})`);

              // First send a mousemove to ensure focus is correct (for browser-internal popups)
              try {
                this.windowManager.sendMouseEvent(slavePid, slaveX, slaveY, 'mousemove');
              } catch (error) {
                logger.warn(`Failed to send pre-keyboard mousemove to slave ${slavePid}:`, error);
              }

              // Small delay before sending keyboard event
              setTimeout(() => {
                try {
                  this.windowManager.sendKeyboardEvent(slavePid, nativeKeycode, 'keydown', slaveX, slaveY);
                  setTimeout(() => {
                    try {
                      this.windowManager.sendKeyboardEvent(slavePid, nativeKeycode, 'keyup', slaveX, slaveY);
                    } catch (error) {
                      logger.error(`Failed to send keyup to slave ${slavePid}:`, error);
                    }
                  }, 10);
                } catch (error) {
                  logger.error(`Failed to send keydown to slave ${slavePid}:`, error);
                }
              }, 5);
            } else {
              // Fallback: no bounds available, send without coordinates
              logger.warn(`  ⚠️  No bounds for slave ${slavePid}, sending without coordinates`);
              this.windowManager.sendKeyboardEvent(slavePid, nativeKeycode, 'keydown', -1, -1);
              setTimeout(() => {
                try {
                  this.windowManager.sendKeyboardEvent(slavePid, nativeKeycode, 'keyup', -1, -1);
                } catch (error) {
                  logger.error(`Failed to send keyup to slave ${slavePid}:`, error);
                }
              }, 10);
            }
          }
        } catch (error) {
          logger.error(`Failed to send keydown to slave ${slavePid}:`, error);
        }
      }
    } catch (error) {
      logger.error('Error in handleKeyDown:', error);
    }
  }

  /**
   * Handle key up events
   * Only synchronizes when mouse is in master window (indicating user focus)
   * NOTE: This listener is currently disabled (see setupEventListeners) to prevent duplicate input
   */
  private handleKeyUp(event: KeyboardEventData): void {
    try {
      if (!this.isCapturing) {
        devLogger.debug('Keyup skipped: not capturing');
        return;
      }
      if (!this.syncOptions.enableKeyboardSync) {
        devLogger.debug('Keyup skipped: keyboard sync disabled');
        return;
      }

      // Only sync keyboard events when mouse is in master window
      // This prevents keyboard input from other windows being synchronized
      if (!this.isMouseInMasterOrExtension(this.lastMouseX, this.lastMouseY)) {
        devLogger.debug('Keyup skipped: mouse not in master');
        return;
      }

      // Validate window manager
      if (!this.windowManager) {
        logger.error('Window manager not initialized in handleKeyUp');
        return;
      }

      // Get rawcode (native OS keycode) from @tkomde/iohook
      // rawcode is the preferred field when useRawcode(true) is enabled
      const {keycode, rawcode} = event;

      // Use rawcode if available (native OS keycode), otherwise fallback to keycode
      const nativeKeycode = rawcode ?? keycode;

      // Validate keycode
      if (nativeKeycode === undefined || nativeKeycode === null) {
        logger.warn('Invalid keycode/rawcode in handleKeyUp:', {keycode, rawcode});
        return;
      }

      // Increment event counter
      this.keyEventCounter++;

      // Deduplication: Check if this is a duplicate event
      const now = Date.now();
      const isDuplicate = this.lastKeyEvent &&
          this.lastKeyEvent.keycode === nativeKeycode &&
          this.lastKeyEvent.type === 'keyup' &&
          now - this.lastKeyEvent.time < this.KEY_DEDUP_THRESHOLD_MS;

      if (isDuplicate) {
        logger.warn('⚠️  DUPLICATE keyup detected and ignored', {
          nativeKeycode,
          timeSinceLast: now - this.lastKeyEvent!.time,
          threshold: this.KEY_DEDUP_THRESHOLD_MS,
          eventCounter: this.keyEventCounter,
        });
        return;
      }

      // Update last key event
      this.lastKeyEvent = {keycode: nativeKeycode, type: 'keyup', time: now};

      devLogger.info('⬆️  Keyup', {
        eventCounter: this.keyEventCounter,
        rawcode,
        keycode,
        nativeKeycode,
        slaveCount: this.slaveWindowPids.size,
      });

      // Send to slave windows
      for (const slavePid of this.slaveWindowPids) {
        try {
          this.windowManager.sendKeyboardEvent(slavePid, nativeKeycode, 'keyup');
          devLogger.debug(`  → Sent to slave ${slavePid}`);
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
