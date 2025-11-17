# IOhook Platform-Specific Setup

## Overview

This project uses different iohook libraries for different platforms:

- **Windows**: `@tkomde/iohook` (existing)
- **macOS**: `iohook-macos` (new)

The platform-specific logic is handled automatically by `/packages/main/src/utils/iohook-wrapper.ts`, which provides a unified API compatible with the existing code.

## Architecture

### iohook-wrapper.ts

The wrapper provides:

1. **Platform Detection**: Automatically loads the correct library based on `process.platform`
2. **API Adapter**: For macOS, wraps `iohook-macos` with an adapter that translates events to `@tkomde/iohook` compatible format
3. **Unified Interface**: The rest of the codebase doesn't need to know which library is being used

### Event Mapping

The adapter translates `iohook-macos` events to `@tkomde/iohook` format:

| iohook-macos | @tkomde/iohook | Notes |
|--------------|----------------|-------|
| `mouseMoved` | `mousemove` | - |
| `leftMouseDown` | `mousedown` | button=1 |
| `leftMouseUp` | `mouseup` | button=1 |
| `rightMouseDown` | `mousedown` | button=2 |
| `rightMouseUp` | `mouseup` | button=2 |
| `keyDown` | `keydown` | Includes modifier keys |
| `keyUp` | `keyup` | Includes modifier keys |
| `scrollWheel` | `mousewheel` | rotation/direction mapped |

## Platform Differences

### Windows vs macOS Event Handling

**Windows (Direct Window Messaging)**:
- Uses `PostMessage`/`SendMessage` to send events directly to window handles
- **No mouse cursor movement** - events are sent virtually to the target window
- Very efficient and precise

**macOS (Global Event Posting)**:
- Uses `CGEventPost` to send events globally to the system
- **Cursor movement is required** - macOS simulates real mouse/keyboard input
- The implementation saves and restores cursor position to minimize visual impact
- Small delays (10-15ms) are needed for events to register before cursor restoration

**Technical Limitation**:
On macOS, when you click in the master window, you may see a brief cursor movement to the slave window(s). This is because:
1. macOS doesn't support direct window-targeted events like Windows
2. Events must be sent globally at specific screen coordinates
3. The cursor is moved → event is sent → cursor is restored

**Performance Impact**:
- Windows: Instant, no visible side effects
- macOS: ~15-20ms per event with brief cursor movement (minimized by fast restoration)

## macOS Setup

### First-Time Use

When you first run the application on macOS, you need to grant **Accessibility Permissions**:

1. The application will automatically detect missing permissions and show an error
2. Open **System Preferences** (or **System Settings** on macOS 13+)
3. Go to **Security & Privacy** → **Privacy** → **Accessibility**
4. Click the lock icon and enter your password
5. Add your application to the list (or check the box if already listed)
6. Restart the application

### Permission Checking

The wrapper automatically checks permissions before starting event monitoring:

```typescript
// Automatically called in iohook-wrapper.ts
const permissions = iohookMacOS.checkAccessibilityPermissions();
if (!permissions.hasPermissions) {
  iohookMacOS.requestAccessibilityPermissions();
  throw new Error('Accessibility permissions required...');
}
```

### Troubleshooting

**Error: "Accessibility permissions required"**
- Solution: Follow the "First-Time Use" steps above

**Error: "uIOhook.start is not a function"**
- This was the original error before implementing the adapter
- The adapter now translates `start()` → `startMonitoring()`

**Events not firing on macOS**
- Verify accessibility permissions are granted
- Check Console.app for any native module errors
- Ensure the application is in the Accessibility list

## Windows Setup

No changes required. The application continues to use `@tkomde/iohook` as before.

## Development

### Building

The native modules are built automatically during `npm install` via the postinstall script:

```bash
npm install  # Automatically builds native addons
```

### Testing Platform-Specific Code

To test the iohook wrapper:

```bash
# On macOS - will load iohook-macos
npm run watch:mac

# On Windows - will load @tkomde/iohook
npm run watch
```

### Adding New Event Types

If you need to add support for new event types:

1. Check if the event is supported in both libraries
2. Add the event mapping in `IOhookMacOSAdapter.setupEventForwarding()`
3. Ensure the event data structure is compatible

## Dependencies

### package.json

```json
{
  "dependencies": {
    "@tkomde/iohook": "^1.1.7",  // Windows
    "iohook-macos": "latest"      // macOS
  }
}
```

### Native Modules

- `@tkomde/iohook`: Requires node-gyp build on Windows
- `iohook-macos`: Pre-compiled binary for macOS
- `window-addon`: Custom native addon (cross-platform)

## Migration Notes

### Code Changes

The migration only required changes to:

1. `/packages/main/src/utils/iohook-wrapper.ts` - New wrapper/adapter
2. `/packages/main/src/services/multi-window-sync-service.ts` - Import from wrapper instead of direct require

### Backward Compatibility

- ✅ Windows functionality unchanged
- ✅ Existing event handlers work without modification
- ✅ API surface remains the same
- ✅ No breaking changes to calling code

## References

- [iohook-macos GitHub](https://github.com/hwanyong/iohook-macos)
- [iohook-macos npm](https://www.npmjs.com/package/iohook-macos)
- [@tkomde/iohook GitHub](https://github.com/tkoins/iohook)
