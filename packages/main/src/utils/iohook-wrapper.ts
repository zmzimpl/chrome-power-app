/**
 * Platform-specific iohook wrapper
 * Uses @tkomde/iohook for Windows and iohook-macos for macOS
 * Provides a unified API compatible with @tkomde/iohook interface
 */

import {createLogger} from '../../../shared/utils/logger';
import type {SafeAny} from '../../../shared/types/db';
import {EventEmitter} from 'events';

const logger = createLogger('iohook-wrapper');

/**
 * Adapter class that wraps iohook-macos to provide @tkomde/iohook compatible API
 */
class IOhookMacOSAdapter extends EventEmitter {
  private iohookMacOS: SafeAny;
  private isStarted: boolean = false;

  constructor(iohookMacOS: SafeAny) {
    super();
    this.iohookMacOS = iohookMacOS;
    this.setupEventForwarding();
  }

  /**
   * Setup event forwarding from iohook-macos events to @tkomde/iohook compatible events
   */
  private setupEventForwarding(): void {
    // Map iohook-macos events to @tkomde/iohook event names

    // Mouse move
    this.iohookMacOS.on('mouseMoved', (event: SafeAny) => {
      this.emit('mousemove', {
        x: event.x,
        y: event.y,
        type: 'mousemove',
      });
    });

    // Left mouse button
    this.iohookMacOS.on('leftMouseDown', (event: SafeAny) => {
      this.emit('mousedown', {
        x: event.x,
        y: event.y,
        button: 1, // Left button
        clicks: 1,
        type: 'mousedown',
      });
    });

    this.iohookMacOS.on('leftMouseUp', (event: SafeAny) => {
      this.emit('mouseup', {
        x: event.x,
        y: event.y,
        button: 1, // Left button
        clicks: 1,
        type: 'mouseup',
      });
    });

    // Right mouse button
    this.iohookMacOS.on('rightMouseDown', (event: SafeAny) => {
      this.emit('mousedown', {
        x: event.x,
        y: event.y,
        button: 2, // Right button
        clicks: 1,
        type: 'mousedown',
      });
    });

    this.iohookMacOS.on('rightMouseUp', (event: SafeAny) => {
      this.emit('mouseup', {
        x: event.x,
        y: event.y,
        button: 2, // Right button
        clicks: 1,
        type: 'mouseup',
      });
    });

    // Keyboard events
    this.iohookMacOS.on('keyDown', (event: SafeAny) => {
      this.emit('keydown', {
        keycode: event.keyCode,
        rawcode: event.keyCode,
        type: 'keydown',
        altKey: event.modifiers?.option || false,
        ctrlKey: event.modifiers?.control || false,
        metaKey: event.modifiers?.command || false,
        shiftKey: event.modifiers?.shift || false,
      });
    });

    this.iohookMacOS.on('keyUp', (event: SafeAny) => {
      this.emit('keyup', {
        keycode: event.keyCode,
        rawcode: event.keyCode,
        type: 'keyup',
        altKey: event.modifiers?.option || false,
        ctrlKey: event.modifiers?.control || false,
        metaKey: event.modifiers?.command || false,
        shiftKey: event.modifiers?.shift || false,
      });
    });

    // Mouse wheel / scroll
    this.iohookMacOS.on('scrollWheel', (event: SafeAny) => {
      // iohook-macos doesn't provide rotation/direction in the same format
      // We need to infer from the event data
      // For now, emit a basic wheel event
      this.emit('mousewheel', {
        x: event.x || 0,
        y: event.y || 0,
        rotation: event.deltaY || 0, // May need adjustment based on actual event data
        direction: 3, // Vertical scroll
        amount: Math.abs(event.deltaY || 0),
        type: 'mousewheel',
      });
    });

    // Generic event listener
    this.iohookMacOS.on('event', (event: SafeAny) => {
      this.emit('input', event);
    });
  }

  /**
   * Start event monitoring - compatible with @tkomde/iohook start()
   */
  start(): void {
    if (this.isStarted) {
      logger.warn('iohook-macos monitoring already started');
      return;
    }

    // Check accessibility permissions first
    const permissions = this.iohookMacOS.checkAccessibilityPermissions();
    if (!permissions.hasPermissions) {
      logger.error('Accessibility permissions not granted');
      logger.info('Requesting accessibility permissions...');
      this.iohookMacOS.requestAccessibilityPermissions();
      throw new Error(
        'Accessibility permissions required. Please grant permissions in System Preferences > Security & Privacy > Privacy > Accessibility',
      );
    }

    this.iohookMacOS.startMonitoring();
    this.isStarted = true;
    logger.info('iohook-macos monitoring started');
  }

  /**
   * Stop event monitoring - compatible with @tkomde/iohook stop()
   */
  stop(): void {
    if (!this.isStarted) {
      return;
    }

    this.iohookMacOS.stopMonitoring();
    this.isStarted = false;
    logger.info('iohook-macos monitoring stopped');
  }

  /**
   * Enable rawcode mode (compatibility method - iohook-macos always provides rawcode)
   */
  useRawcode(enable: boolean): void {
    // iohook-macos always provides keyCode, so this is a no-op for compatibility
    logger.debug(`useRawcode(${enable}) - no-op for iohook-macos (keyCode always available)`);
  }
}

let iohookModule: SafeAny = null;

/**
 * Load the appropriate iohook module based on the platform
 */
export function loadIOhook(): SafeAny {
  if (iohookModule) {
    return iohookModule;
  }

  try {
    const platform = process.platform;

    if (platform === 'darwin') {
      // macOS - use iohook-macos with adapter
      logger.info('Loading iohook-macos for macOS...');
      const iohookMacOS = require('iohook-macos');

      // Wrap iohook-macos with adapter to provide @tkomde/iohook compatible API
      iohookModule = new IOhookMacOSAdapter(iohookMacOS);
      logger.info('iohook-macos loaded successfully with compatibility adapter');
    } else if (platform === 'win32') {
      // Windows - use @tkomde/iohook directly (no adapter needed)
      logger.info('Loading @tkomde/iohook for Windows...');
      const iohook = require('@tkomde/iohook');

      // Enable rawcode mode if available
      if (typeof iohook.useRawcode === 'function') {
        iohook.useRawcode(true);
        logger.info('@tkomde/iohook loaded successfully with rawcode enabled');
      } else {
        logger.info('@tkomde/iohook loaded successfully (rawcode mode not available)');
      }

      iohookModule = iohook;
    } else {
      // Unsupported platform
      logger.error(`Unsupported platform: ${platform}`);
      throw new Error(`IOhook is not supported on platform: ${platform}`);
    }

    return iohookModule;
  } catch (error) {
    logger.error('Failed to load iohook:', error);
    throw error;
  }
}

/**
 * Get the loaded iohook instance (if any)
 */
export function getIOhook(): SafeAny | null {
  return iohookModule;
}
