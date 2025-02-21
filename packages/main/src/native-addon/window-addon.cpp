#include <napi.h>
#include <iostream>

#ifdef _WIN32
#include <windows.h>
#include <cstring>
#elif __APPLE__
#include <ApplicationServices/ApplicationServices.h>
#endif

#define LOG_ERROR(msg)                                                               \
    do                                                                               \
    {                                                                                \
        std::cerr << "Error: " << msg << " (line: " << __LINE__ << ")" << std::endl; \
    } while (0)

#define CHECK_WINDOW_OPERATION(op, msg)                                 \
    do                                                                  \
    {                                                                   \
        if (!(op))                                                      \
        {                                                               \
            LOG_ERROR(msg << " (LastError: " << GetLastError() << ")"); \
        }                                                               \
    } while (0)

struct WindowInfo
{
    HWND hwnd;
    bool isExtension;
    int width;
    int height;
};

class WindowManager : public Napi::ObjectWrap<WindowManager>
{
public:
    static Napi::Object Init(Napi::Env env, Napi::Object exports)
    {
        Napi::Function func = DefineClass(env, "WindowManager", {InstanceMethod("arrangeWindows", &WindowManager::ArrangeWindows)});

        Napi::FunctionReference *constructor = new Napi::FunctionReference();
        *constructor = Napi::Persistent(func);
        env.SetInstanceData(constructor);

        exports.Set("WindowManager", func);
        return exports;
    }

    WindowManager(const Napi::CallbackInfo &info) : Napi::ObjectWrap<WindowManager>(info) {}

private:
    Napi::Value ArrangeWindows(const Napi::CallbackInfo &info)
    {
        Napi::Env env = info.Env();

        if (info.Length() < 5)
        {
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
        for (uint32_t i = 0; i < childPidsArray.Length(); i++)
        {
            childPids.push_back(childPidsArray.Get(i).As<Napi::Number>().Int32Value());
        }

#ifdef _WIN32
        // Windows implementation
        RECT workArea;
        SystemParametersInfo(SPI_GETWORKAREA, 0, &workArea, 0);
        int screenWidth = workArea.right - workArea.left;
        int screenHeight = workArea.bottom - workArea.top;

        int effectiveWidth = width > 0 ? width : screenWidth / columns;
        int effectiveHeight = height > 0 ? height : screenHeight / ((childPids.size() + 1 + columns - 1) / columns);

        // Handle main window and its extensions
        auto mainWindows = FindWindowsByPid(mainPid);
        WindowInfo *mainWindow = nullptr;
        std::vector<WindowInfo *> mainExtensions;

        for (auto &win : mainWindows)
        {
            if (!win.isExtension)
            {
                mainWindow = &win;
            }
            else
            {
                mainExtensions.push_back(&win);
            }
        }

        if (mainWindow)
        {
            int x = spacing;
            int y = spacing;
            ArrangeWindow(mainWindow->hwnd, x, y, effectiveWidth - spacing * 2, effectiveHeight - spacing * 2);

            // Arrange extensions for main window
            for (auto ext : mainExtensions)
            {
                ArrangeWindow(ext->hwnd,
                              x + effectiveWidth - ext->width - spacing,
                              y,
                              ext->width,
                              ext->height,
                              true);
            }
        }

        // Handle child windows
        for (size_t i = 0; i < childPids.size(); i++)
        {
            auto childWindows = FindWindowsByPid(childPids[i]);
            WindowInfo *childMain = nullptr;
            std::vector<WindowInfo *> childExtensions;

            for (auto &win : childWindows)
            {
                if (!win.isExtension)
                {
                    childMain = &win;
                }
                else
                {
                    childExtensions.push_back(&win);
                }
            }

            if (childMain)
            {
                int row = (i + 1) / columns;
                int col = (i + 1) % columns;
                int x = col * effectiveWidth + spacing;
                int y = row * effectiveHeight + spacing;

                ArrangeWindow(childMain->hwnd,
                              x,
                              y,
                              effectiveWidth - spacing * 2,
                              effectiveHeight - spacing * 2);

                // Arrange extensions for child window
                for (auto ext : childExtensions)
                {
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
        // macOS implementation
        CGRect mainDisplayBounds = CGDisplayBounds(CGMainDisplayID());
        float screenWidth = mainDisplayBounds.size.width;
        float screenHeight = mainDisplayBounds.size.height;

        float windowWidth = width > 0 ? width : screenWidth / columns;
        float windowHeight = height > 0 ? height : screenHeight / ((childPids.size() + 1 + columns - 1) / columns);

        // Arrange main window
        ArrangeMacWindow(mainPid, 0, 0, windowWidth, windowHeight);

        // Arrange child windows
        for (size_t i = 0; i < childPids.size(); i++)
        {
            int row = (i + 1) / columns;
            int col = (i + 1) % columns;
            ArrangeMacWindow(childPids[i],
                             col * windowWidth,
                             row * windowHeight,
                             windowWidth, windowHeight);
        }
#endif

        return env.Null();
    }

#ifdef _WIN32
    HWND FindWindowByPid(DWORD processId)
    {
        HWND hwnd = nullptr;
        try
        {
            while ((hwnd = FindWindowEx(nullptr, hwnd, nullptr, nullptr)) != nullptr)
            {
                DWORD pid = 0;
                DWORD threadId = GetWindowThreadProcessId(hwnd, &pid);
                if (threadId == 0)
                {
                    LOG_ERROR("Failed to get window thread process id");
                    continue;
                }

                if (pid == processId)
                {
                    char className[256] = {0};
                    if (GetClassNameA(hwnd, className, sizeof(className)) == 0)
                    {
                        LOG_ERROR("Failed to get window class name");
                        continue;
                    }

                    char title[256] = {0};
                    if (GetWindowTextA(hwnd, title, sizeof(title)) == 0 && GetLastError() != 0)
                    {
                        LOG_ERROR("Failed to get window title");
                        continue;
                    }

                    if ((strstr(className, "Chrome") != nullptr ||
                         strstr(title, "Chrome") != nullptr) &&
                        IsWindowVisible(hwnd) &&
                        !IsIconic(hwnd))
                    {

                        LONG style = GetWindowLong(hwnd, GWL_STYLE);
                        if (style & WS_OVERLAPPEDWINDOW)
                        {
                            return hwnd;
                        }
                    }
                }
            }
        }
        catch (...)
        {
            LOG_ERROR("Exception in FindWindowByPid");
        }
        return nullptr;
    }

    bool IsExtensionWindow(const char *title, const char *className)
    {
        // Check if the title exists and doesn't contain "Google Chrome"
        return title != nullptr &&
               strlen(title) > 0 &&
               strstr(title, "Google Chrome") == nullptr;
    }

    std::vector<WindowInfo> FindWindowsByPid(DWORD processId)
    {
        std::vector<WindowInfo> windows;
        HWND hwnd = nullptr;

        while ((hwnd = FindWindowEx(nullptr, hwnd, nullptr, nullptr)) != nullptr)
        {
            DWORD pid = 0;
            GetWindowThreadProcessId(hwnd, &pid);

            if (pid == processId && IsWindowVisible(hwnd) && !IsIconic(hwnd))
            {
                char className[256] = {0};
                GetClassNameA(hwnd, className, sizeof(className));

                char title[256] = {0};
                GetWindowTextA(hwnd, title, sizeof(title));

                RECT rect;
                GetWindowRect(hwnd, &rect);

                bool isExtension = IsExtensionWindow(title, className);
                bool isMainWindow = strstr(title, "Google Chrome") != nullptr &&
                                    (GetWindowLong(hwnd, GWL_STYLE) & WS_OVERLAPPEDWINDOW);

                if (isMainWindow || isExtension)
                {
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
    void ArrangeMacWindow(int pid, float x, float y, float width, float height)
    {
        AXUIElementRef app = AXUIElementCreateApplication(pid);
        if (app)
        {
            AXUIElementRef window = nullptr;
            CFArrayRef windowArray = nullptr;
            AXUIElementCopyAttributeValue(app, kAXWindowsAttribute, (CFTypeRef *)&windowArray);

            if (windowArray && CFArrayGetCount(windowArray) > 0)
            {
                window = (AXUIElementRef)CFArrayGetValueAtIndex(windowArray, 0);

                CGPoint position = {x, y};
                CGSize size = {width, height};

                AXValueRef positionRef = AXValueCreate(kAXValueCGPointType, &position);
                AXValueRef sizeRef = AXValueCreate(kAXValueCGSizeType, &size);

                AXUIElementSetAttributeValue(window, kAXPositionAttribute, positionRef);
                AXUIElementSetAttributeValue(window, kAXSizeAttribute, sizeRef);

                CFRelease(positionRef);
                CFRelease(sizeRef);
            }

            if (windowArray)
                CFRelease(windowArray);
            CFRelease(app);
        }
    }
#endif

    bool ArrangeWindow(HWND hwnd, int x, int y, int width, int height, bool preserveSize = false)
    {
        if (!hwnd) return false;
        
        // Ensure window is not minimized and bring it to front
        if (IsIconic(hwnd)) {
            ShowWindow(hwnd, SW_RESTORE);
        }
        SetForegroundWindow(hwnd);
        
        // Remove maximize and minimize styles from window
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
        
        // Set window position and size
        UINT flags = SWP_SHOWWINDOW | SWP_FRAMECHANGED;
        if (preserveSize) {
            flags |= SWP_NOSIZE;
        }
        
        // Use HWND_TOPMOST temporarily to ensure window comes to front
        if (!SetWindowPos(hwnd, HWND_TOPMOST, x, y, width, height, flags)) {
            LOG_ERROR("Failed to set window position");
            return false;
        }
        
        // Then remove topmost state
        if (!SetWindowPos(hwnd, HWND_NOTOPMOST, x, y, width, height, flags)) {
            LOG_ERROR("Failed to reset window z-order");
            return false;
        }
        
        return true;
    }
};

Napi::Object Init(Napi::Env env, Napi::Object exports)
{
    return WindowManager::Init(env, exports);
}

NODE_API_MODULE(window_addon, Init)
