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
    wheelThrottleMs: 50,
    cdpSyncIntervalMs: 100,
  };

  // CDP connections
  private cdpBrowsers: Map<number, Browser> = new Map();
  private cdpSyncInterval: NodeJS.Timeout | null = null;
  private lastScrollPosition: {x: number; y: number} = {x: 0, y: 0};

  // Throttling for wheel events
  private lastWheelTime: number = 0;

  // Keyboard event deduplication
  private lastKeyEvent: {keycode: number; type: 'keydown' | 'keyup'; time: number} | null = null;
  private readonly KEY_DEDUP_THRESHOLD_MS = 50; // Ignore duplicate events within 50ms
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
      logger.info('🔍 Generic input event received:', {
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
   * Check if mouse is in master window or its extension/popup windows
   * This is used for keyboard sync to allow typing in popup windows
   */
  private isMouseInMasterOrExtensionWindow(x: number, y: number): boolean {
    // First check if mouse is in master window
    if (this.isMouseInMasterWindow(x, y)) {
      return true;
    }

    // Then check if mouse is in any extension window of the master process
    if (this.masterWindowPid !== null) {
      const masterExtensions = this.extensionWindows.get(this.masterWindowPid);
      if (masterExtensions) {
        for (const extWin of masterExtensions) {
          const {x: wx, y: wy, width, height} = extWin.bounds;
          if (x >= wx && x <= wx + width && y >= wy && y <= wy + height) {
            logger.debug(`Mouse in master extension window: ${extWin.title || 'unknown'}`);
            return true;
          }
        }
      }
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
   * Only tracks focus for keyboard sync - no position synchronization
   * Position is synced before clicks/scrolls for performance
   */
  private handleMouseMove(event: MouseEventData): void {
    try {
      if (!this.isCapturing || !this.masterWindowBounds) return;

      const now = Date.now();
      const {x, y} = event;

      // Check if mouse is in master window or its extension/popup windows
      // This is critical for keyboard synchronization to work in popup windows
      const inMasterOrExtension = this.isMouseInMasterOrExtensionWindow(x, y);
      if (inMasterOrExtension) {
        this.isMouseInMaster = true;
        this.lastMouseCheckTime = now;
      } else {
        // Consider focus lost if mouse hasn't been in master/extension for timeout period
        if (now - this.lastMouseCheckTime > this.MOUSE_FOCUS_TIMEOUT_MS) {
          this.isMouseInMaster = false;
        }
      }

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
        logger.debug('Master window not active - skipping mouse event');
        return;
      }

      // Also check if mouse is within master window bounds
      if (!this.isMouseInMasterWindow(x, y)) return;

      const eventType = button === 1 ? 'mousedown' : button === 2 ? 'rightdown' : 'mousedown';

      logger.info(`🖱️ Mouse ${eventType} at (${x}, ${y}), button=${button}, slaves=${this.slaveWindowPids.size}`);

      // Calculate relative position in master window
      const ratio = this.calculateRelativePosition(x, y);
      if (!ratio) return;

      // Sync mouse position before click to ensure accurate targeting
      // This is critical since we don't continuously sync mousemove for performance
      for (const [slavePid, slaveBounds] of this.slaveWindowBounds) {
        const slavePos = this.applyToSlaveWindow(ratio, slaveBounds);
        try {
          // First, sync position to ensure hover states and targeting accuracy
          this.windowManager.sendMouseEvent(slavePid, slavePos.x, slavePos.y, 'mousemove');

          // Small delay to allow hover effects to settle before clicking
          setTimeout(() => {
            try {
              this.windowManager.sendMouseEvent(slavePid, slavePos.x, slavePos.y, eventType);
              logger.debug(`→ Sent ${eventType} to slave ${slavePid} at (${slavePos.x}, ${slavePos.y})`);
            } catch (error) {
              logger.error(`Failed to send ${eventType} to slave ${slavePid}:`, error);
            }
          }, 10);
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

      // Check if master window is active (foreground)
      if (!this.windowManager.isProcessWindowActive(this.masterWindowPid)) {
        logger.debug('Master window not active - skipping mouse event');
        return;
      }

      // Also check if mouse is within master window bounds
      if (!this.isMouseInMasterWindow(x, y)) return;

      const eventType = button === 1 ? 'mouseup' : button === 2 ? 'rightup' : 'mouseup';

      logger.info(`🖱️ Mouse ${eventType} at (${x}, ${y}), button=${button}, slaves=${this.slaveWindowPids.size}`);

      // Calculate relative position in master window
      const ratio = this.calculateRelativePosition(x, y);
      if (!ratio) return;

      // Send to each slave window with calculated screen coordinates
      for (const [slavePid, slaveBounds] of this.slaveWindowBounds) {
        const slavePos = this.applyToSlaveWindow(ratio, slaveBounds);
        try {
          logger.debug(`→ Sending ${eventType} to slave ${slavePid} at (${slavePos.x}, ${slavePos.y})`);
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
   * @tkomde/iohook wheel event structure:
   * - rotation: scroll amount with direction (positive = scroll down, negative = scroll up)
   * - amount: absolute scroll amount (always positive)
   * - direction: 3 for vertical, 4 for horizontal
   * - x, y: mouse position
   */
  private handleWheel(event: WheelEventData): void {
    try {
      logger.info('🎡 Wheel event received!', {
        event,
        isCapturing: this.isCapturing,
        hasMasterBounds: !!this.masterWindowBounds,
      });

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

      const {x, y, rotation, amount, direction} = event;
      const inMaster = this.isMouseInMasterWindow(x, y);
      if (!inMaster) {
        logger.debug(`Wheel event skipped: mouse not in master (${x}, ${y})`);
        return;
      }

      logger.info('Processing wheel event', {
        x,
        y,
        rotation,
        amount,
        direction,
        slavePids: Array.from(this.slaveWindowPids),
      });

      // Skip horizontal scrolling for now (can be added later if needed)
      if (direction === 4) {
        logger.debug('Horizontal scroll event skipped');
        return;
      }

      // Calculate deltaY from rotation
      // rotation is positive for scroll down, negative for scroll up
      // Windows expects negative values for scroll down
      let deltaY = -rotation;

      // Apply scroll amplification based on amount
      const absAmount = Math.abs(amount);
      if (absAmount <= 1) {
        // Small scroll: use 1:1 mapping
        deltaY = deltaY * 120; // Standard wheel delta is 120 units per notch
      } else if (absAmount <= 3) {
        // Medium scroll: slight amplification for better feel
        deltaY = deltaY * 150;
      } else {
        // Large scroll: amplify for fast scrolling
        deltaY = deltaY * 200;
      }

      // Round to integer
      deltaY = Math.round(deltaY);

      logger.info(`Sending wheel event: deltaY=${deltaY} (rotation=${rotation}, amount=${amount})`);

      // Calculate relative position in master window
      const ratio = this.calculateRelativePosition(x, y);
      if (!ratio) {
        logger.warn('Failed to calculate relative position for wheel event');
        return;
      }

      // Send to each slave window with calculated screen coordinates
      for (const [slavePid, slaveBounds] of this.slaveWindowBounds) {
        const slavePos = this.applyToSlaveWindow(ratio, slaveBounds);
        try {
          this.windowManager.sendWheelEvent(slavePid, 0, deltaY, slavePos.x, slavePos.y);
          logger.info(`✓ Wheel event sent to slave ${slavePid} at (${slavePos.x}, ${slavePos.y})`);
        } catch (error) {
          logger.error(`Failed to send wheel event to slave ${slavePid}:`, error);
        }
      }
    } catch (error) {
      logger.error('Error in handleWheel:', error);
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
      logger.info('🚫 Ignoring Ctrl+C (Copy) - not syncing to slaves');
      return true;
    }

    // Filter other common shortcuts
    if (ctrlKey && !altKey && !shiftKey) {
      const ignoredKeycodes: {[key: number]: string} = {
        86: 'Ctrl+V (Paste)',
        88: 'Ctrl+X (Cut)',
        65: 'Ctrl+A (Select All)',
        90: 'Ctrl+Z (Undo)',
        89: 'Ctrl+Y (Redo)',
        83: 'Ctrl+S (Save)',
        70: 'Ctrl+F (Find)',
        72: 'Ctrl+H (History)',
        78: 'Ctrl+N (New)',
        84: 'Ctrl+T (New Tab)',
        87: 'Ctrl+W (Close Tab)',
        82: 'Ctrl+R (Refresh)',
      };

      if (nativeKeycode in ignoredKeycodes) {
        logger.info(`🚫 Ignoring ${ignoredKeycodes[nativeKeycode]} - not syncing to slaves`);
        return true;
      }
    }

    return false;
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
      logger.info('🔍 DEBUG: Complete keyboard event', {
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

      logger.info('⌨️  Key press', {
        eventCounter: this.keyEventCounter,
        rawcode,
        keycode,
        nativeKeycode,
        slaveCount: this.slaveWindowPids.size,
      });

      // Send complete key press to slave windows (keydown + keyup)
      // This prevents duplicate input issues
      for (const slavePid of this.slaveWindowPids) {
        try {
          // Send keydown
          this.windowManager.sendKeyboardEvent(slavePid, nativeKeycode, 'keydown');

          // Immediately send keyup to complete the key press
          // Small timeout ensures proper event sequencing
          setTimeout(() => {
            try {
              this.windowManager.sendKeyboardEvent(slavePid, nativeKeycode, 'keyup');
            } catch (error) {
              logger.error(`Failed to send keyup to slave ${slavePid}:`, error);
            }
          }, 10);

          logger.debug(`  → Sent key press to slave ${slavePid}`);
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

      logger.info('⬆️  Keyup', {
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
          logger.debug(`  → Sent to slave ${slavePid}`);
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
