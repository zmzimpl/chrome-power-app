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

class WindowManager : public Napi::ObjectWrap<WindowManager> {
public:
    static Napi::Object Init(Napi::Env env, Napi::Object exports) {
        Napi::Function func = DefineClass(env, "WindowManager", {
            InstanceMethod("arrangeWindows", &WindowManager::ArrangeWindows),
            InstanceMethod("sendMouseEvent", &WindowManager::SendMouseEvent),
            InstanceMethod("sendKeyboardEvent", &WindowManager::SendKeyboardEvent),
            InstanceMethod("sendWheelEvent", &WindowManager::SendWheelEvent),
            InstanceMethod("getWindowBounds", &WindowManager::GetWindowBounds)
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
    struct MonitorInfo {
        HMONITOR handle;
        RECT rect;
        bool isPrimary;
    };

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
    struct MonitorInfo {
        CGDirectDisplayID id;
        CGRect bounds;
        bool isPrimary;
    };

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
    #endif

    Napi::Value ArrangeWindows(const Napi::CallbackInfo& info) {
        Napi::Env env = info.Env();

        if (info.Length() < 5) {
            throw Napi::TypeError::New(env, "Wrong number of arguments");
            return env.Null();
        }

        int mainPid = info[0].As<Napi::Number>().Int32Value();
        Napi::Array childPidsArray = info[1].As<Napi::Array>();
        int columns = info[2].As<Napi::Number>().Int32Value();
        Napi::Object size = info[3].As<Napi::Object>();
        int spacing = info[4].As<Napi::Number>().Int32Value();

        int width = size.Get("width").As<Napi::Number>().Int32Value();
        int height = size.Get("height").As<Napi::Number>().Int32Value();

        std::vector<int> childPids;
        for (uint32_t i = 0; i < childPidsArray.Length(); i++) {
            childPids.push_back(childPidsArray.Get(i).As<Napi::Number>().Int32Value());
        }

        // Get all available monitors
        auto monitors = GetMonitors();
        if (monitors.empty()) {
            throw Napi::Error::New(env, "No monitors found");
            return env.Null();
        }

#ifdef _WIN32
        // Use the first monitor (preferably a non-primary one)
        const auto& monitor = monitors[0];
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
        // Use the first monitor (preferably a non-primary one)
        const auto& monitor = monitors[0];
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
            throw Napi::TypeError::New(env, "Wrong number of arguments");
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
            throw Napi::TypeError::New(env, "Wrong number of arguments: pid, x, y, eventType");
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

        RECT rect;
        GetWindowRect(mainWindow->hwnd, &rect);
        int clientX = x - rect.left;
        int clientY = y - rect.top;
        LPARAM lParam = MAKELPARAM(clientX, clientY);

        if (eventType == "mousemove") {
            PostMessage(mainWindow->hwnd, WM_MOUSEMOVE, 0, lParam);
        } else if (eventType == "mousedown") {
            PostMessage(mainWindow->hwnd, WM_LBUTTONDOWN, MK_LBUTTON, lParam);
        } else if (eventType == "mouseup") {
            PostMessage(mainWindow->hwnd, WM_LBUTTONUP, 0, lParam);
        } else if (eventType == "rightdown") {
            PostMessage(mainWindow->hwnd, WM_RBUTTONDOWN, MK_RBUTTON, lParam);
        } else if (eventType == "rightup") {
            PostMessage(mainWindow->hwnd, WM_RBUTTONUP, 0, lParam);
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
            throw Napi::TypeError::New(env, "Wrong number of arguments: pid, keyCode, eventType");
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

        if (eventType == "keydown") {
            PostMessage(mainWindow->hwnd, WM_KEYDOWN, keyCode, 0);
        } else if (eventType == "keyup") {
            PostMessage(mainWindow->hwnd, WM_KEYUP, keyCode, 0);
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
            throw Napi::TypeError::New(env, "Wrong number of arguments: pid, deltaX, deltaY");
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
        WPARAM wParam = MAKEWPARAM(0, deltaY * 120); // 120 is WHEEL_DELTA
        PostMessage(mainWindow->hwnd, WM_MOUSEWHEEL, wParam, 0);

#elif __APPLE__
        CGEventRef event = CGEventCreateScrollWheelEvent(NULL, kCGScrollEventUnitPixel, 2, deltaY, deltaX);
        if (event) {
            CGEventPost(kCGHIDEventTap, event);
            CFRelease(event);
        }
#endif

        return Napi::Boolean::New(env, true);
    }
};

Napi::Object Init(Napi::Env env, Napi::Object exports) {
    return WindowManager::Init(env, exports);
}

NODE_API_MODULE(window_addon, Init)
