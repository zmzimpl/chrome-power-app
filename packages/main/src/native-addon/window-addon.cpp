#include <napi.h>
#include <iostream>

#ifdef __APPLE__
#import <Foundation/Foundation.h>
#import <Cocoa/Cocoa.h>
#import <CoreFoundation/CoreFoundation.h>
#import <CoreGraphics/CoreGraphics.h>
#endif

#ifdef _WIN32
#include <windows.h>
#include <cstring>
#endif

// Error logging macro
#define LOG_ERROR(msg) \
    do { \
        std::cerr << "Error: " << msg << " (line: " << __LINE__ << ")" << std::endl; \
    } while (0)

#ifdef _WIN32
    #define CHECK_WINDOW_OPERATION(op, msg) \
        do { \
            if (!(op)) { \
                LOG_ERROR(msg << " (LastError: " << GetLastError() << ")"); \
            } \
        } while (0)
#endif

// Platform specific window info structure
#ifdef _WIN32
struct WindowInfo {
    HWND hwnd;
    bool isExtension;
    int width;
    int height;
};
#elif __APPLE__
struct WindowInfo {
    AXUIElementRef window;
    pid_t pid;
    bool isExtension;
    int width;
    int height;
};
#endif

// Monitor info structure (for multi-monitor support)
#ifdef _WIN32
struct MonitorInfo {
    HMONITOR handle;
    RECT rect;
    bool isPrimary;
};
#elif __APPLE__
struct MonitorInfo {
    CGDirectDisplayID id;
    CGRect bounds;
    bool isPrimary;
};
#else
// Dummy struct for Linux (not supported but allows compilation)
struct MonitorInfo {
    int id;
    bool isPrimary;
    int x, y, width, height;
};
#endif

// Forward declaration of GetMonitors function
std::vector<MonitorInfo> GetMonitors();

class WindowManager : public Napi::ObjectWrap<WindowManager> {
public:
    static Napi::Object Init(Napi::Env env, Napi::Object exports) {
        Napi::Function func = DefineClass(env, "WindowManager", {
            InstanceMethod("arrangeWindows", &WindowManager::ArrangeWindows),
            InstanceMethod("sendMouseEvent", &WindowManager::SendMouseEvent),
            InstanceMethod("sendMouseEventWithPopupMatching", &WindowManager::SendMouseEventWithPopupMatching),
            InstanceMethod("sendKeyboardEvent", &WindowManager::SendKeyboardEvent),
            InstanceMethod("sendWheelEvent", &WindowManager::SendWheelEvent),
            InstanceMethod("getWindowBounds", &WindowManager::GetWindowBounds),
            InstanceMethod("getMonitors", &WindowManager::GetMonitorsJS),
            InstanceMethod("isProcessWindowActive", &WindowManager::IsProcessWindowActive)
        });

        Napi::FunctionReference* constructor = new Napi::FunctionReference();
        *constructor = Napi::Persistent(func);
        env.SetInstanceData(constructor);

        exports.Set("WindowManager", func);
        return exports;
    }

    WindowManager(const Napi::CallbackInfo& info) : Napi::ObjectWrap<WindowManager>(info) {}

private:
    #ifdef _WIN32
    bool ArrangeWindow(HWND hwnd, int x, int y, int width, int height, bool preserveSize = false) {
        if (!hwnd) return false;
        
        if (IsIconic(hwnd)) {
            ShowWindow(hwnd, SW_RESTORE);
        }
        SetForegroundWindow(hwnd);
        
        LONG style = GetWindowLong(hwnd, GWL_STYLE);
        if (style == 0) {
            LOG_ERROR("Failed to get window style");
            return false;
        }
        
        style &= ~(WS_MAXIMIZE | WS_MINIMIZE);
        if (SetWindowLong(hwnd, GWL_STYLE, style) == 0) {
            LOG_ERROR("Failed to set window style");
            return false;
        }
        
        UINT flags = SWP_SHOWWINDOW | SWP_FRAMECHANGED;
        if (preserveSize) {
            flags |= SWP_NOSIZE;
        }
        
        if (!SetWindowPos(hwnd, HWND_TOPMOST, x, y, width, height, flags)) {
            LOG_ERROR("Failed to set window position");
            return false;
        }
        
        if (!SetWindowPos(hwnd, HWND_NOTOPMOST, x, y, width, height, flags)) {
            LOG_ERROR("Failed to reset window z-order");
            return false;
        }
        
        return true;
    }

    bool IsExtensionWindow(const char* title, const char* className) {
        return title != nullptr &&
               strlen(title) > 0 &&
               strstr(title, "Google Chrome") == nullptr;
    }

    std::vector<WindowInfo> FindWindowsByPid(DWORD processId) {
        std::vector<WindowInfo> windows;
        HWND hwnd = nullptr;

        while ((hwnd = FindWindowEx(nullptr, hwnd, nullptr, nullptr)) != nullptr) {
            DWORD pid = 0;
            GetWindowThreadProcessId(hwnd, &pid);

            if (pid == processId && IsWindowVisible(hwnd) && !IsIconic(hwnd)) {
                char className[256] = {0};
                GetClassNameA(hwnd, className, sizeof(className));

                char title[256] = {0};
                GetWindowTextA(hwnd, title, sizeof(title));

                RECT rect;
                GetWindowRect(hwnd, &rect);

                bool isExtension = IsExtensionWindow(title, className);
                bool isMainWindow = strstr(title, "Google Chrome") != nullptr &&
                                  (GetWindowLong(hwnd, GWL_STYLE) & WS_OVERLAPPEDWINDOW);

                if (isMainWindow || isExtension) {
                    WindowInfo info;
                    info.hwnd = hwnd;
                    info.isExtension = isExtension;
                    info.width = rect.right - rect.left;
                    info.height = rect.bottom - rect.top;
                    windows.push_back(info);
                }
            }
        }
        return windows;
    }

    // Find popup windows (like context menus) belonging to a process
    std::vector<HWND> FindPopupWindows(DWORD processId) {
        std::vector<HWND> popups;
        HWND hwnd = nullptr;

        while ((hwnd = FindWindowEx(nullptr, hwnd, nullptr, nullptr)) != nullptr) {
            DWORD pid = 0;
            GetWindowThreadProcessId(hwnd, &pid);

            if (pid == processId && IsWindowVisible(hwnd)) {
                LONG style = GetWindowLong(hwnd, GWL_STYLE);

                // Check if it's a popup window (WS_POPUP)
                if (style & WS_POPUP) {
                    char className[256] = {0};
                    GetClassNameA(hwnd, className, sizeof(className));

                    // Common popup window classes: #32768 (menu), Chrome_WidgetWin_1, etc.
                    if (strcmp(className, "#32768") == 0 ||
                        strstr(className, "Chrome_WidgetWin") != nullptr) {
                        popups.push_back(hwnd);
                    }
                }
            }
        }
        return popups;
    }

    // Find best matching popup window based on relative position
    HWND FindMatchingPopup(HWND masterMainWindow, HWND masterPopup,
                          HWND slaveMainWindow, const std::vector<HWND>& slavePopups) {
        if (slavePopups.empty()) {
            return nullptr;
        }

        // Get master popup position relative to master main window
        RECT masterMainRect, masterPopupRect;
        GetWindowRect(masterMainWindow, &masterMainRect);
        GetWindowRect(masterPopup, &masterPopupRect);

        int masterRelX = masterPopupRect.left - masterMainRect.left;
        int masterRelY = masterPopupRect.top - masterMainRect.top;

        // Get slave main window position
        RECT slaveMainRect;
        GetWindowRect(slaveMainWindow, &slaveMainRect);

        // Find slave popup with closest relative position
        HWND bestMatch = nullptr;
        int minDistance = INT_MAX;

        for (HWND slavePopup : slavePopups) {
            RECT slavePopupRect;
            GetWindowRect(slavePopup, &slavePopupRect);

            int slaveRelX = slavePopupRect.left - slaveMainRect.left;
            int slaveRelY = slavePopupRect.top - slaveMainRect.top;

            // Calculate Manhattan distance
            int distance = abs(masterRelX - slaveRelX) + abs(masterRelY - slaveRelY);

            if (distance < minDistance) {
                minDistance = distance;
                bestMatch = slavePopup;
            }
        }

        return bestMatch;
    }
    #elif __APPLE__
    bool CheckAccessibilityPermission() {
        @autoreleasepool {
            NSDictionary* options = @{(id)kAXTrustedCheckOptionPrompt: @YES};
            BOOL isEnabled = AXIsProcessTrustedWithOptions((__bridge CFDictionaryRef)options);
            
            if (!isEnabled) {
                NSAlert* alert = [[NSAlert alloc] init];
                [alert setMessageText:@"Accessibility Permission Required"];
                [alert setInformativeText:@"Chrome Power needs accessibility permission to manage windows. Please enable it in System Preferences."];
                [alert addButtonWithTitle:@"Open System Preferences"];
                [alert addButtonWithTitle:@"Cancel"];
                
                if ([alert runModal] == NSAlertFirstButtonReturn) {
                    [[NSWorkspace sharedWorkspace] openURL:[NSURL URLWithString:@"x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"]];
                }
            }
            
            return isEnabled;
        }
    }

    bool IsExtensionWindow(AXUIElementRef window) {
        // Check window title
        CFStringRef titleRef;
        if (AXUIElementCopyAttributeValue(window, kAXTitleAttribute, (CFTypeRef*)&titleRef) == kAXErrorSuccess) {
            char buffer[256];
            CFStringGetCString(titleRef, buffer, sizeof(buffer), kCFStringEncodingUTF8);
            CFRelease(titleRef);
            
            // Extension windows typically don't have "Google Chrome" in their titles
            // and are usually smaller floating windows
            if (strstr(buffer, "Google Chrome") == nullptr) {
                return true;
            }
        }

        // Check window role
        CFStringRef roleRef;
        if (AXUIElementCopyAttributeValue(window, kAXRoleAttribute, (CFTypeRef*)&roleRef) == kAXErrorSuccess) {
            char buffer[256];
            CFStringGetCString(roleRef, buffer, sizeof(buffer), kCFStringEncodingUTF8);
            CFRelease(roleRef);
            
            // Extension windows might have different roles
            if (strcmp(buffer, "AXWindow") == 0) {
                // Additional check for window level
                CFStringRef subroleRef;
                if (AXUIElementCopyAttributeValue(window, kAXSubroleAttribute, (CFTypeRef*)&subroleRef) == kAXErrorSuccess) {
                    char subroleBuffer[256];
                    CFStringGetCString(subroleRef, subroleBuffer, sizeof(subroleBuffer), kCFStringEncodingUTF8);
                    CFRelease(subroleRef);
                    
                    return strcmp(subroleBuffer, "AXStandardWindow") != 0;
                }
            }
        }

        return false;
    }

    void BringWindowToFront(AXUIElementRef window) {
        // Get the window's PID
        pid_t windowPid;
        if (AXUIElementGetPid(window, &windowPid) == kAXErrorSuccess) {
            // Create a new NSRunningApplication instance
            @autoreleasepool {
                NSRunningApplication* app = [NSRunningApplication runningApplicationWithProcessIdentifier:windowPid];
                if (app) {
                    [app activateWithOptions:NSApplicationActivateIgnoringOtherApps];
                }
            }
        }

        // Raise the window
        AXUIElementPerformAction(window, kAXRaiseAction);
    }

    bool IsMainWindow(AXUIElementRef window) {
        // Check window title
        CFStringRef titleRef;
        if (AXUIElementCopyAttributeValue(window, kAXTitleAttribute, (CFTypeRef*)&titleRef) == kAXErrorSuccess) {
            char buffer[256];
            CFStringGetCString(titleRef, buffer, sizeof(buffer), kCFStringEncodingUTF8);
            CFRelease(titleRef);
            
            // Main Chrome window should contain "Google Chrome" in title
            if (strstr(buffer, "Google Chrome") != nullptr) {
                // Also check subrole to ensure it's a standard window
                CFStringRef subroleRef;
                if (AXUIElementCopyAttributeValue(window, kAXSubroleAttribute, (CFTypeRef*)&subroleRef) == kAXErrorSuccess) {
                    char subroleBuffer[256];
                    CFStringGetCString(subroleRef, subroleBuffer, sizeof(subroleBuffer), kCFStringEncodingUTF8);
                    CFRelease(subroleRef);
                    
                    // Main window should have "AXStandardWindow" subrole
                    return strcmp(subroleBuffer, "AXStandardWindow") == 0;
                }
            }
        }
        
        return false;
    }

    std::vector<WindowInfo> GetWindowsForPid(pid_t pid) {
        std::vector<WindowInfo> windows;
        AXUIElementRef app = AXUIElementCreateApplication(pid);
        if (!app) {
            LOG_ERROR("Failed to create AX UI Element for application");
            return windows;
        }

        CFArrayRef windowArray;
        if (AXUIElementCopyAttributeValue(app, kAXWindowsAttribute, (CFTypeRef*)&windowArray) == kAXErrorSuccess) {
            CFIndex count = CFArrayGetCount(windowArray);
            for (CFIndex i = 0; i < count; i++) {
                AXUIElementRef window = (AXUIElementRef)CFArrayGetValueAtIndex(windowArray, i);
                
                // Only process visible windows
                CFBooleanRef isMinimizedRef;
                bool isVisible = true;
                if (AXUIElementCopyAttributeValue(window, kAXMinimizedAttribute, (CFTypeRef*)&isMinimizedRef) == kAXErrorSuccess) {
                    isVisible = !CFBooleanGetValue(isMinimizedRef);
                    CFRelease(isMinimizedRef);
                }

                if (isVisible) {
                    CGSize size = {0, 0};
                    AXValueRef sizeRef;
                    if (AXUIElementCopyAttributeValue(window, kAXSizeAttribute, (CFTypeRef*)&sizeRef) == kAXErrorSuccess) {
                        AXValueGetValue(sizeRef, (AXValueType)kAXValueCGSizeType, &size);
                        CFRelease(sizeRef);

                        bool isExtension = IsExtensionWindow(window);
                        bool isMain = IsMainWindow(window);

                        if (isMain || isExtension) {
                            WindowInfo info;
                            info.window = (AXUIElementRef)CFRetain(window);
                            info.pid = pid;
                            info.isExtension = isExtension;
                            info.width = static_cast<int>(size.width);
                            info.height = static_cast<int>(size.height);
                            windows.push_back(info);
                        }
                    }
                }
            }
            CFRelease(windowArray);
        }
        CFRelease(app);
        return windows;
    }

    bool ArrangeWindow(pid_t pid, float x, float y, float width, float height, bool preserveSize = false) {
        auto windows = GetWindowsForPid(pid);
        if (windows.empty()) {
            LOG_ERROR("No windows found for process");
            return false;
        }

        WindowInfo* mainWindow = nullptr;
        std::vector<WindowInfo*> extensionWindows;

        for (auto& window : windows) {
            if (!window.isExtension) {
                mainWindow = &window;
            } else {
                extensionWindows.push_back(&window);
            }
        }

        if (!mainWindow) {
            LOG_ERROR("Main window not found");
            return false;
        }

        // Position and size for main window
        CGPoint position = CGPointMake(x, y);
        AXValueRef positionRef = AXValueCreate((AXValueType)kAXValueCGPointType, &position);
        if (positionRef) {
            AXUIElementSetAttributeValue(mainWindow->window, kAXPositionAttribute, positionRef);
            CFRelease(positionRef);
        }

        if (!preserveSize) {
            CGSize size = CGSizeMake(width, height);
            AXValueRef sizeRef = AXValueCreate((AXValueType)kAXValueCGSizeType, &size);
            if (sizeRef) {
                AXUIElementSetAttributeValue(mainWindow->window, kAXSizeAttribute, sizeRef);
                CFRelease(sizeRef);
            }
        }

        // Bring main window to front
        BringWindowToFront(mainWindow->window);

        // Handle extension windows
        for (auto extWindow : extensionWindows) {
            // Position extension windows at the right edge of the main window
            CGPoint extPosition = CGPointMake(x + width - extWindow->width - 10, y);
            AXValueRef extPositionRef = AXValueCreate((AXValueType)kAXValueCGPointType, &extPosition);
            if (extPositionRef) {
                AXUIElementSetAttributeValue(extWindow->window, kAXPositionAttribute, extPositionRef);
                CFRelease(extPositionRef);
            }

            // Bring extension window to front
            BringWindowToFront(extWindow->window);
        }

        // Clean up
        for (auto& window : windows) {
            if (window.window) {
                CFRelease(window.window);
            }
        }

        return true;
    }
    #endif

    #ifdef _WIN32
    std::vector<MonitorInfo> GetMonitors() {
        std::vector<MonitorInfo> monitors;
        EnumDisplayMonitors(NULL, NULL, [](HMONITOR hMonitor, HDC, LPRECT, LPARAM lParam) -> BOOL {
            auto& monitors = *reinterpret_cast<std::vector<MonitorInfo>*>(lParam);
            MONITORINFOEX monitorInfo;
            monitorInfo.cbSize = sizeof(MONITORINFOEX);
            
            if (GetMonitorInfo(hMonitor, &monitorInfo)) {
                MonitorInfo info;
                info.handle = hMonitor;
                info.rect = monitorInfo.rcWork;
                info.isPrimary = (monitorInfo.dwFlags & MONITORINFOF_PRIMARY) != 0;
                monitors.push_back(info);
            }
            return TRUE;
        }, reinterpret_cast<LPARAM>(&monitors));
        
        // Sort monitors so that non-primary monitors come first
        std::sort(monitors.begin(), monitors.end(), 
            [](const MonitorInfo& a, const MonitorInfo& b) {
                return a.isPrimary < b.isPrimary;
            });
        
        return monitors;
    }
    #elif __APPLE__
    std::vector<MonitorInfo> GetMonitors() {
        std::vector<MonitorInfo> monitors;
        uint32_t displayCount;
        CGDirectDisplayID displays[32];
        
        if (CGGetActiveDisplayList(32, displays, &displayCount) == kCGErrorSuccess) {
            CGDirectDisplayID mainDisplay = CGMainDisplayID();
            
            for (uint32_t i = 0; i < displayCount; i++) {
                MonitorInfo info;
                info.id = displays[i];
                info.bounds = CGDisplayBounds(displays[i]);
                info.isPrimary = (displays[i] == mainDisplay);
                monitors.push_back(info);
            }
            
            // Sort monitors so that non-primary monitors come first
            std::sort(monitors.begin(), monitors.end(), 
                [](const MonitorInfo& a, const MonitorInfo& b) {
                    return a.isPrimary < b.isPrimary;
                });
        }
        
        return monitors;
    }
    #else
    // Linux implementation (returns empty - not supported)
    std::vector<MonitorInfo> GetMonitors() {
        return std::vector<MonitorInfo>();
    }
    #endif

    // Expose GetMonitors to JavaScript
    Napi::Value GetMonitorsJS(const Napi::CallbackInfo& info) {
        Napi::Env env = info.Env();
        Napi::Array result = Napi::Array::New(env);

        auto monitors = GetMonitors();

        for (size_t i = 0; i < monitors.size(); i++) {
            Napi::Object monitorObj = Napi::Object::New(env);

#ifdef _WIN32
            monitorObj.Set("x", Napi::Number::New(env, monitors[i].rect.left));
            monitorObj.Set("y", Napi::Number::New(env, monitors[i].rect.top));
            monitorObj.Set("width", Napi::Number::New(env, monitors[i].rect.right - monitors[i].rect.left));
            monitorObj.Set("height", Napi::Number::New(env, monitors[i].rect.bottom - monitors[i].rect.top));
#elif __APPLE__
            monitorObj.Set("x", Napi::Number::New(env, monitors[i].bounds.origin.x));
            monitorObj.Set("y", Napi::Number::New(env, monitors[i].bounds.origin.y));
            monitorObj.Set("width", Napi::Number::New(env, monitors[i].bounds.size.width));
            monitorObj.Set("height", Napi::Number::New(env, monitors[i].bounds.size.height));
#else
            monitorObj.Set("x", Napi::Number::New(env, monitors[i].x));
            monitorObj.Set("y", Napi::Number::New(env, monitors[i].y));
            monitorObj.Set("width", Napi::Number::New(env, monitors[i].width));
            monitorObj.Set("height", Napi::Number::New(env, monitors[i].height));
#endif
            monitorObj.Set("isPrimary", Napi::Boolean::New(env, monitors[i].isPrimary));
            monitorObj.Set("index", Napi::Number::New(env, i));

            result[i] = monitorObj;
        }

        return result;
    }

    Napi::Value ArrangeWindows(const Napi::CallbackInfo& info) {
        Napi::Env env = info.Env();

        if (info.Length() < 5) {
            Napi::TypeError::New(env, "Wrong number of arguments");
            return env.Null();
        }

        int mainPid = info[0].As<Napi::Number>().Int32Value();
        Napi::Array childPidsArray = info[1].As<Napi::Array>();
        int columns = info[2].As<Napi::Number>().Int32Value();
        Napi::Object size = info[3].As<Napi::Object>();
        int spacing = info[4].As<Napi::Number>().Int32Value();

        // Optional 6th argument: monitor index (defaults to 0)
        int monitorIndex = 0;
        if (info.Length() >= 6 && info[5].IsNumber()) {
            monitorIndex = info[5].As<Napi::Number>().Int32Value();
        }

        int width = size.Get("width").As<Napi::Number>().Int32Value();
        int height = size.Get("height").As<Napi::Number>().Int32Value();

        std::vector<int> childPids;
        for (uint32_t i = 0; i < childPidsArray.Length(); i++) {
            childPids.push_back(childPidsArray.Get(i).As<Napi::Number>().Int32Value());
        }

        // Get all available monitors
        auto monitors = GetMonitors();
        if (monitors.empty()) {
            Napi::Error::New(env, "No monitors found");
            return env.Null();
        }

        // Validate monitor index
        if (monitorIndex < 0 || monitorIndex >= static_cast<int>(monitors.size())) {
            Napi::Error::New(env, "Invalid monitor index");
            return env.Null();
        }

#ifdef _WIN32
        // Use the selected monitor
        const auto& monitor = monitors[monitorIndex];
        int screenWidth = monitor.rect.right - monitor.rect.left;
        int screenHeight = monitor.rect.bottom - monitor.rect.top;
        int screenX = monitor.rect.left;
        int screenY = monitor.rect.top;

        // Calculate total windows and rows
        int totalWindows = childPids.size() + 1;
        int rows = (totalWindows + columns - 1) / columns;

        // Calculate effective dimensions with spacing
        int availableWidth = screenWidth - (spacing * (columns + 1));
        int availableHeight = screenHeight - (spacing * (rows + 1));
        int effectiveWidth = width > 0 ? width : availableWidth / columns;
        int effectiveHeight = height > 0 ? height : availableHeight / rows;

        // Handle main window and its extensions
        auto mainWindows = FindWindowsByPid(mainPid);
        WindowInfo* mainWindow = nullptr;
        std::vector<WindowInfo*> mainExtensions;

        for (auto& win : mainWindows) {
            if (!win.isExtension) {
                mainWindow = &win;
            } else {
                mainExtensions.push_back(&win);
            }
        }

        if (mainWindow) {
            int row = 0;
            int col = 0;
            int x = screenX + col * effectiveWidth + spacing;
            int y = screenY + row * effectiveHeight + spacing;
            ArrangeWindow(mainWindow->hwnd, x, y, effectiveWidth - spacing * 2, effectiveHeight - spacing * 2);

            for (auto ext : mainExtensions) {
                ArrangeWindow(ext->hwnd,
                            x + effectiveWidth - ext->width - spacing,
                            y,
                            ext->width,
                            ext->height,
                            true);
            }
        }

        // Handle child windows
        for (size_t i = 0; i < childPids.size(); i++) {
            auto childWindows = FindWindowsByPid(childPids[i]);
            WindowInfo* childMain = nullptr;
            std::vector<WindowInfo*> childExtensions;

            for (auto& win : childWindows) {
                if (!win.isExtension) {
                    childMain = &win;
                } else {
                    childExtensions.push_back(&win);
                }
            }

            if (childMain) {
                int row = (i + 1) / columns;
                int col = (i + 1) % columns;
                int x = screenX + (col * effectiveWidth) + (spacing * (col + 1));
                int y = screenY + (row * effectiveHeight) + (spacing * (row + 1));

                ArrangeWindow(childMain->hwnd,
                            x,
                            y,
                            effectiveWidth - spacing,
                            effectiveHeight - spacing);

                // Handle extensions
                for (auto ext : childExtensions) {
                    ArrangeWindow(ext->hwnd,
                                x + effectiveWidth - ext->width - spacing,
                                y,
                                ext->width,
                                ext->height,
                                true);
                }
            }
        }
#elif __APPLE__
        // Use the selected monitor
        const auto& monitor = monitors[monitorIndex];
        float screenWidth = monitor.bounds.size.width;
        float screenHeight = monitor.bounds.size.height;
        float screenX = monitor.bounds.origin.x;
        float screenY = monitor.bounds.origin.y;

        // Calculate total windows and rows
        int totalWindows = childPids.size() + 1;
        int rows = (totalWindows + columns - 1) / columns;

        // Calculate effective dimensions with spacing
        float availableWidth = screenWidth - (spacing * (columns + 1));
        float availableHeight = screenHeight - (spacing * (rows + 1));
        float effectiveWidth = width > 0 ? width : availableWidth / columns;
        float effectiveHeight = height > 0 ? height : availableHeight / rows;

        // Handle main window
        ArrangeWindow(mainPid, 
                     screenX + spacing, 
                     screenY + spacing, 
                     effectiveWidth - spacing * 2, 
                     effectiveHeight - spacing * 2);

        // Handle child windows
        for (size_t i = 0; i < childPids.size(); i++) {
            int row = (i + 1) / columns;
            int col = (i + 1) % columns;
            float x = screenX + (col * effectiveWidth) + (spacing * (col + 1));
            float y = screenY + (row * effectiveHeight) + (spacing * (row + 1));
            
            ArrangeWindow(childPids[i],
                         x,
                         y,
                         effectiveWidth - spacing,
                         effectiveHeight - spacing);
        }
#endif

        return env.Null();
    }

    // Get window bounds by PID
    Napi::Value GetWindowBounds(const Napi::CallbackInfo& info) {
        Napi::Env env = info.Env();

        if (info.Length() < 1) {
            Napi::TypeError::New(env, "Wrong number of arguments");
        }

        int pid = info[0].As<Napi::Number>().Int32Value();
        Napi::Object result = Napi::Object::New(env);

#ifdef _WIN32
        auto windows = FindWindowsByPid(pid);
        if (!windows.empty()) {
            WindowInfo* mainWindow = nullptr;
            for (auto& win : windows) {
                if (!win.isExtension) {
                    mainWindow = &win;
                    break;
                }
            }

            if (mainWindow) {
                RECT rect;
                if (GetWindowRect(mainWindow->hwnd, &rect)) {
                    result.Set("x", Napi::Number::New(env, rect.left));
                    result.Set("y", Napi::Number::New(env, rect.top));
                    result.Set("width", Napi::Number::New(env, rect.right - rect.left));
                    result.Set("height", Napi::Number::New(env, rect.bottom - rect.top));
                    result.Set("success", Napi::Boolean::New(env, true));
                }
            }
        }
#elif __APPLE__
        auto windows = GetWindowsForPid(pid);
        if (!windows.empty()) {
            WindowInfo* mainWindow = nullptr;
            for (auto& win : windows) {
                if (!win.isExtension) {
                    mainWindow = &win;
                    break;
                }
            }

            if (mainWindow) {
                CGPoint position;
                CGSize size;
                AXValueRef posRef, sizeRef;

                if (AXUIElementCopyAttributeValue(mainWindow->window, kAXPositionAttribute, (CFTypeRef*)&posRef) == kAXErrorSuccess) {
                    AXValueGetValue(posRef, (AXValueType)kAXValueCGPointType, &position);
                    CFRelease(posRef);

                    if (AXUIElementCopyAttributeValue(mainWindow->window, kAXSizeAttribute, (CFTypeRef*)&sizeRef) == kAXErrorSuccess) {
                        AXValueGetValue(sizeRef, (AXValueType)kAXValueCGSizeType, &size);
                        CFRelease(sizeRef);

                        result.Set("x", Napi::Number::New(env, position.x));
                        result.Set("y", Napi::Number::New(env, position.y));
                        result.Set("width", Napi::Number::New(env, size.width));
                        result.Set("height", Napi::Number::New(env, size.height));
                        result.Set("success", Napi::Boolean::New(env, true));
                    }
                }
                CFRelease(mainWindow->window);
            }
        }
#endif

        if (!result.Has("success")) {
            result.Set("success", Napi::Boolean::New(env, false));
        }

        return result;
    }

    // Send mouse event to window
    Napi::Value SendMouseEvent(const Napi::CallbackInfo& info) {
        Napi::Env env = info.Env();

        if (info.Length() < 4) {
            Napi::TypeError::New(env, "Wrong number of arguments: pid, x, y, eventType");
        }

        int pid = info[0].As<Napi::Number>().Int32Value();
        int x = info[1].As<Napi::Number>().Int32Value();
        int y = info[2].As<Napi::Number>().Int32Value();
        std::string eventType = info[3].As<Napi::String>().Utf8Value();

#ifdef _WIN32
        auto windows = FindWindowsByPid(pid);
        if (windows.empty()) {
            return Napi::Boolean::New(env, false);
        }

        WindowInfo* mainWindow = nullptr;
        for (auto& win : windows) {
            if (!win.isExtension) {
                mainWindow = &win;
                break;
            }
        }

        if (!mainWindow) {
            return Napi::Boolean::New(env, false);
        }

        // Find popup windows for this process
        std::vector<HWND> popupWindows = FindPopupWindows(pid);

        // Check if click position is on a popup window
        HWND targetWindow = mainWindow->hwnd;
        HWND clickedPopup = nullptr;

        // Check each popup window to see if the click is within its bounds
        for (HWND popup : popupWindows) {
            RECT popupRect;
            GetWindowRect(popup, &popupRect);

            if (x >= popupRect.left && x <= popupRect.right &&
                y >= popupRect.top && y <= popupRect.bottom) {
                clickedPopup = popup;
                targetWindow = popup;
                break;
            }
        }

        // Calculate coordinates relative to target window
        RECT rect;
        GetWindowRect(targetWindow, &rect);
        int clientX = x - rect.left;
        int clientY = y - rect.top;
        LPARAM lParam = MAKELPARAM(clientX, clientY);

        // Send event to target window (either main window or popup)
        if (eventType == "mousemove") {
            PostMessage(targetWindow, WM_MOUSEMOVE, 0, lParam);
        } else if (eventType == "mousedown") {
            PostMessage(targetWindow, WM_LBUTTONDOWN, MK_LBUTTON, lParam);
        } else if (eventType == "mouseup") {
            PostMessage(targetWindow, WM_LBUTTONUP, 0, lParam);
        } else if (eventType == "rightdown") {
            PostMessage(targetWindow, WM_RBUTTONDOWN, MK_RBUTTON, lParam);
        } else if (eventType == "rightup") {
            PostMessage(targetWindow, WM_RBUTTONUP, 0, lParam);
        } else {
            return Napi::Boolean::New(env, false);
        }

#elif __APPLE__
        CGPoint point = CGPointMake(x, y);
        CGEventType cgEventType;
        CGMouseButton button = kCGMouseButtonLeft;

        if (eventType == "mousemove") {
            cgEventType = kCGEventMouseMoved;
        } else if (eventType == "mousedown") {
            cgEventType = kCGEventLeftMouseDown;
        } else if (eventType == "mouseup") {
            cgEventType = kCGEventLeftMouseUp;
        } else if (eventType == "rightdown") {
            cgEventType = kCGEventRightMouseDown;
            button = kCGMouseButtonRight;
        } else if (eventType == "rightup") {
            cgEventType = kCGEventRightMouseUp;
            button = kCGMouseButtonRight;
        } else {
            return Napi::Boolean::New(env, false);
        }

        CGEventRef event = CGEventCreateMouseEvent(NULL, cgEventType, point, button);
        if (event) {
            CGEventPost(kCGHIDEventTap, event);
            CFRelease(event);
        }
#endif

        return Napi::Boolean::New(env, true);
    }

    // Send keyboard event to window
    Napi::Value SendKeyboardEvent(const Napi::CallbackInfo& info) {
        Napi::Env env = info.Env();

        if (info.Length() < 3) {
            Napi::TypeError::New(env, "Wrong number of arguments: pid, keyCode, eventType");
        }

        int pid = info[0].As<Napi::Number>().Int32Value();
        int keyCode = info[1].As<Napi::Number>().Int32Value();
        std::string eventType = info[2].As<Napi::String>().Utf8Value();

#ifdef _WIN32
        auto windows = FindWindowsByPid(pid);
        if (windows.empty()) {
            return Napi::Boolean::New(env, false);
        }

        WindowInfo* mainWindow = nullptr;
        for (auto& win : windows) {
            if (!win.isExtension) {
                mainWindow = &win;
                break;
            }
        }

        if (!mainWindow) {
            return Napi::Boolean::New(env, false);
        }

        // Build lParam for extended keys
        // Bit 24: Extended-key flag (1 for extended keys like arrows, Insert, Delete, etc.)
        // Check if this is an extended key based on the VK code
        bool isExtendedKey = (
            keyCode == VK_INSERT || keyCode == VK_DELETE || keyCode == VK_HOME ||
            keyCode == VK_END || keyCode == VK_PRIOR || keyCode == VK_NEXT ||
            keyCode == VK_LEFT || keyCode == VK_UP || keyCode == VK_RIGHT || keyCode == VK_DOWN ||
            keyCode == VK_NUMLOCK || keyCode == VK_DIVIDE
        );

        LPARAM lParam = 1; // Repeat count = 1
        if (isExtendedKey) {
            lParam |= (1 << 24); // Set extended-key flag
        }

        if (eventType == "keydown") {
            PostMessage(mainWindow->hwnd, WM_KEYDOWN, keyCode, lParam);
        } else if (eventType == "keyup") {
            lParam |= (1 << 30); // Previous key state (1 = key was down)
            lParam |= (1 << 31); // Transition state (1 = key is being released)
            PostMessage(mainWindow->hwnd, WM_KEYUP, keyCode, lParam);
        }

#elif __APPLE__
        CGEventRef event;
        bool isKeyDown = (eventType == "keydown");

        event = CGEventCreateKeyboardEvent(NULL, (CGKeyCode)keyCode, isKeyDown);
        if (event) {
            CGEventPost(kCGHIDEventTap, event);
            CFRelease(event);
        }
#endif

        return Napi::Boolean::New(env, true);
    }

    // Send wheel event to window
    Napi::Value SendWheelEvent(const Napi::CallbackInfo& info) {
        Napi::Env env = info.Env();

        if (info.Length() < 3) {
            Napi::TypeError::New(env, "Wrong number of arguments: pid, deltaX, deltaY");
        }

        int pid = info[0].As<Napi::Number>().Int32Value();
        int deltaX = info[1].As<Napi::Number>().Int32Value();
        int deltaY = info[2].As<Napi::Number>().Int32Value();

#ifdef _WIN32
        auto windows = FindWindowsByPid(pid);
        if (windows.empty()) {
            return Napi::Boolean::New(env, false);
        }

        WindowInfo* mainWindow = nullptr;
        for (auto& win : windows) {
            if (!win.isExtension) {
                mainWindow = &win;
                break;
            }
        }

        if (!mainWindow) {
            return Napi::Boolean::New(env, false);
        }

        // Send wheel event
        // Note: deltaY is already multiplied by WHEEL_DELTA (120) in TypeScript

        // Get current cursor position (screen coordinates required for WM_MOUSEWHEEL)
        POINT cursorPos;
        GetCursorPos(&cursorPos);

        // WM_MOUSEWHEEL: wParam = key state | delta, lParam = screen coords
        WPARAM wParam = MAKEWPARAM(0, deltaY);
        LPARAM lParam = MAKELPARAM(cursorPos.x, cursorPos.y);

        // Use SendMessage instead of PostMessage for better reliability
        SendMessage(mainWindow->hwnd, WM_MOUSEWHEEL, wParam, lParam);

#elif __APPLE__
        CGEventRef event = CGEventCreateScrollWheelEvent(NULL, kCGScrollEventUnitPixel, 2, deltaY, deltaX);
        if (event) {
            CGEventPost(kCGHIDEventTap, event);
            CFRelease(event);
        }
#endif

        return Napi::Boolean::New(env, true);
    }

    // Check if any window from the given process is currently active (foreground)
    Napi::Value IsProcessWindowActive(const Napi::CallbackInfo& info) {
        Napi::Env env = info.Env();

        if (info.Length() < 1) {
            Napi::TypeError::New(env, "Wrong number of arguments: pid");
        }

        int pid = info[0].As<Napi::Number>().Int32Value();

#ifdef _WIN32
        // Get the current foreground window
        HWND foregroundWindow = GetForegroundWindow();
        if (!foregroundWindow) {
            return Napi::Boolean::New(env, false);
        }

        // Get the process ID of the foreground window
        DWORD foregroundPid = 0;
        GetWindowThreadProcessId(foregroundWindow, &foregroundPid);

        // Check if it matches our target PID
        bool isActive = (foregroundPid == static_cast<DWORD>(pid));

        return Napi::Boolean::New(env, isActive);

#elif __APPLE__
        // Get the active application
        @autoreleasepool {
            NSRunningApplication* frontApp = [[NSWorkspace sharedWorkspace] frontmostApplication];
            if (!frontApp) {
                return Napi::Boolean::New(env, false);
            }

            pid_t frontPid = [frontApp processIdentifier];
            bool isActive = (frontPid == pid);

            return Napi::Boolean::New(env, isActive);
        }
#else
        return Napi::Boolean::New(env, false);
#endif
    }

    // Send mouse event with popup window matching
    // This finds and matches popup windows between master and slave processes
    Napi::Value SendMouseEventWithPopupMatching(const Napi::CallbackInfo& info) {
        Napi::Env env = info.Env();

        if (info.Length() < 5) {
            Napi::TypeError::New(env, "Wrong number of arguments: masterPid, slavePid, x, y, eventType");
        }

        int masterPid = info[0].As<Napi::Number>().Int32Value();
        int slavePid = info[1].As<Napi::Number>().Int32Value();
        int x = info[2].As<Napi::Number>().Int32Value();
        int y = info[3].As<Napi::Number>().Int32Value();
        std::string eventType = info[4].As<Napi::String>().Utf8Value();

#ifdef _WIN32
        // Find main windows
        auto masterWindows = FindWindowsByPid(masterPid);
        auto slaveWindows = FindWindowsByPid(slavePid);

        if (masterWindows.empty() || slaveWindows.empty()) {
            return Napi::Boolean::New(env, false);
        }

        WindowInfo* masterMainWindow = nullptr;
        WindowInfo* slaveMainWindow = nullptr;

        for (auto& win : masterWindows) {
            if (!win.isExtension) {
                masterMainWindow = &win;
                break;
            }
        }

        for (auto& win : slaveWindows) {
            if (!win.isExtension) {
                slaveMainWindow = &win;
                break;
            }
        }

        if (!masterMainWindow || !slaveMainWindow) {
            return Napi::Boolean::New(env, false);
        }

        // Find popup windows
        std::vector<HWND> masterPopups = FindPopupWindows(masterPid);
        std::vector<HWND> slavePopups = FindPopupWindows(slavePid);

        // Debug: Log popup window counts
        char debugMsg[256];
        sprintf_s(debugMsg, "[C++] Found %zu master popups, %zu slave popups for event '%s'",
                 masterPopups.size(), slavePopups.size(), eventType.c_str());
        OutputDebugStringA(debugMsg);

        // Check if click is on a master popup window
        HWND masterClickedPopup = nullptr;
        for (HWND popup : masterPopups) {
            RECT popupRect;
            GetWindowRect(popup, &popupRect);

            if (x >= popupRect.left && x <= popupRect.right &&
                y >= popupRect.top && y <= popupRect.bottom) {
                masterClickedPopup = popup;
                sprintf_s(debugMsg, "[C++] Click on master popup at (%d, %d)", x, y);
                OutputDebugStringA(debugMsg);
                break;
            }
        }

        HWND targetWindow = slaveMainWindow->hwnd;
        int targetX = x;
        int targetY = y;

        // If clicked on a popup, find matching slave popup
        if (masterClickedPopup) {
            HWND matchingSlavePopup = FindMatchingPopup(
                masterMainWindow->hwnd, masterClickedPopup,
                slaveMainWindow->hwnd, slavePopups);

            if (matchingSlavePopup) {
                targetWindow = matchingSlavePopup;

                // Calculate coordinates relative to the popup window
                RECT masterPopupRect, slavePopupRect;
                GetWindowRect(masterClickedPopup, &masterPopupRect);
                GetWindowRect(matchingSlavePopup, &slavePopupRect);

                // Convert master coordinates to relative position within popup
                int relX = x - masterPopupRect.left;
                int relY = y - masterPopupRect.top;

                // Apply to slave popup
                targetX = slavePopupRect.left + relX;
                targetY = slavePopupRect.top + relY;
            }
        } else {
            // No popup clicked, calculate position for slave main window
            RECT masterMainRect, slaveMainRect;
            GetWindowRect(masterMainWindow->hwnd, &masterMainRect);
            GetWindowRect(slaveMainWindow->hwnd, &slaveMainRect);

            // Calculate relative position in master window
            double relX = (double)(x - masterMainRect.left) / (masterMainRect.right - masterMainRect.left);
            double relY = (double)(y - masterMainRect.top) / (masterMainRect.bottom - masterMainRect.top);

            // Apply to slave window
            targetX = slaveMainRect.left + (int)(relX * (slaveMainRect.right - slaveMainRect.left));
            targetY = slaveMainRect.top + (int)(relY * (slaveMainRect.bottom - slaveMainRect.top));
        }

        // Calculate client coordinates relative to target window
        RECT targetRect;
        GetWindowRect(targetWindow, &targetRect);
        int clientX = targetX - targetRect.left;
        int clientY = targetY - targetRect.top;
        LPARAM lParam = MAKELPARAM(clientX, clientY);

        // For right-click events, we need to move the cursor to ensure Chrome's GetCursorPos()
        // returns the correct position for context menu display
        // Strategy: Move cursor -> Send message -> Restore immediately
        // This is done for each slave window separately to ensure each gets correct menu position
        bool isRightClick = (eventType == "rightdown" || eventType == "rightup");

        POINT originalCursorPos;
        if (isRightClick) {
            // Save current cursor position before any movement
            GetCursorPos(&originalCursorPos);

            // Move cursor to target position (screen coordinates)
            SetCursorPos(targetX, targetY);

            // Small delay to ensure system recognizes the cursor position
            // Chrome calls GetCursorPos() when handling right-click events
            Sleep(3);

            sprintf_s(debugMsg, "[C++] Moved cursor from (%ld, %ld) to (%d, %d) for %s",
                     originalCursorPos.x, originalCursorPos.y, targetX, targetY, eventType.c_str());
            OutputDebugStringA(debugMsg);
        }

        // Send event
        if (eventType == "mousemove") {
            PostMessage(targetWindow, WM_MOUSEMOVE, 0, lParam);
        } else if (eventType == "mousedown") {
            PostMessage(targetWindow, WM_LBUTTONDOWN, MK_LBUTTON, lParam);
        } else if (eventType == "mouseup") {
            PostMessage(targetWindow, WM_LBUTTONUP, 0, lParam);
        } else if (eventType == "rightdown") {
            PostMessage(targetWindow, WM_RBUTTONDOWN, MK_RBUTTON, lParam);

            // Restore cursor after rightdown
            Sleep(2);
            SetCursorPos(originalCursorPos.x, originalCursorPos.y);

            sprintf_s(debugMsg, "[C++] Restored cursor to (%ld, %ld) after rightdown",
                     originalCursorPos.x, originalCursorPos.y);
            OutputDebugStringA(debugMsg);
        } else if (eventType == "rightup") {
            PostMessage(targetWindow, WM_RBUTTONUP, 0, lParam);

            // Restore cursor after rightup with slightly longer delay
            // This allows the context menu to be triggered before cursor returns
            Sleep(5);
            SetCursorPos(originalCursorPos.x, originalCursorPos.y);

            sprintf_s(debugMsg, "[C++] Restored cursor to (%ld, %ld) after rightup",
                     originalCursorPos.x, originalCursorPos.y);
            OutputDebugStringA(debugMsg);
        } else {
            return Napi::Boolean::New(env, false);
        }

#elif __APPLE__
        // TODO: Implement for macOS
        return Napi::Boolean::New(env, false);
#endif

        return Napi::Boolean::New(env, true);
    }
};

Napi::Object Init(Napi::Env env, Napi::Object exports) {
    return WindowManager::Init(env, exports);
}

NODE_API_MODULE(window_addon, Init)
