#include <napi.h>
#include <windows.h>
#include <vector>
#include <iostream>

std::vector<HWND> chromeWindows;
int screenWidth, screenHeight;
std::vector<HWND> g_slaveWindows;
HHOOK g_keyboardHook = NULL;
HHOOK g_mouseHook = NULL;
HWND g_masterWindow = NULL;
Napi::ThreadSafeFunction g_controlActionCallback;

struct ControlActionData
{
    std::string action;
};

BOOL CALLBACK EnumWindowsProc(HWND hwnd, LPARAM lParam)
{
    const DWORD TITLE_SIZE = 1024;
    WCHAR windowTitle[TITLE_SIZE];

    GetWindowTextW(hwnd, windowTitle, TITLE_SIZE);

    int length = ::GetWindowTextLength(hwnd);
    std::wstring title(&windowTitle[0]);
    if (!IsWindowVisible(hwnd) || length == 0 || title.find(L"By ChromePower") == std::wstring::npos)
    {
        return TRUE;
    }

    chromeWindows.push_back(hwnd);
    return TRUE;
}

BOOL CALLBACK EnumWindowsProcByPid(HWND hwnd, LPARAM lParam)
{
    DWORD processId = 0;
    GetWindowThreadProcessId(hwnd, &processId);

    if (processId == (DWORD)lParam)
    {
        chromeWindows.push_back(hwnd);
    }

    return TRUE;
}

void TileWindows()
{
    chromeWindows.clear();

    screenWidth = GetSystemMetrics(SM_CXSCREEN);
    screenHeight = GetSystemMetrics(SM_CYSCREEN);

    EnumWindows(EnumWindowsProc, NULL);

    int numWindows = chromeWindows.size();

    // Handle no windows found
    if (numWindows == 0)
    {
        return;
    }

    // Handle only one window found
    if (numWindows == 1)
    {
        // Optional: Maximize the single window
        // ShowWindow(chromeWindows[0], SW_MAXIMIZE);
        return;
    }

    int rows = ceil(sqrt(numWindows));
    int cols = ceil((double)numWindows / rows);
    int windowWidth = screenWidth / cols;
    int windowHeight = screenHeight / rows;

    for (size_t i = 0; i < chromeWindows.size(); i++)
    {
        int col = i % cols;
        int row = i / cols;
        MoveWindow(chromeWindows[i], col * windowWidth, row * windowHeight, windowWidth, windowHeight, TRUE);
        SetForegroundWindow(chromeWindows[i]);
    }
}

void CallControlActionCallback(const std::string &action)
{
    try {
        auto data = new ControlActionData{action};
        g_controlActionCallback.NonBlockingCall(data, [](Napi::Env env, Napi::Function jsCallback, ControlActionData *data) {
            jsCallback.Call({Napi::String::New(env, data->action)});
            delete data;
        });
    } catch (const std::exception& e) {
        Napi::Error::New(env, e.what()).ThrowAsJavaScript();
    }
}

POINT ConvertScreenToClient(HWND hwnd, POINT pt)
{
    ScreenToClient(hwnd, &pt);
    return pt;
}

LRESULT CALLBACK KeyboardProc(int nCode, WPARAM wParam, LPARAM lParam)
{
    if (nCode >= 0)
    {
        // 获取事件关联的窗口句柄
        KBDLLHOOKSTRUCT *kbStruct = (KBDLLHOOKSTRUCT *)lParam;
        HWND currentWindow = GetForegroundWindow();

        if (currentWindow == g_masterWindow)
        {
            // 处理键盘事件，重放到被控窗口
            for (HWND hwnd : g_slaveWindows)
            {
                PostMessage(hwnd, WM_KEYDOWN, wParam, lParam);
            }
        }
    }
    return CallNextHookEx(NULL, nCode, wParam, lParam);
}

LRESULT CALLBACK MouseProc(int nCode, WPARAM wParam, LPARAM lParam)
{
    if (nCode >= 0)
    {
        MOUSEHOOKSTRUCT *pMouseStruct = (MOUSEHOOKSTRUCT *)lParam;
        HWND currentWindow = GetForegroundWindow();
        if (pMouseStruct != NULL && currentWindow == g_masterWindow)
        {
            if (pMouseStruct != NULL)
            {
                if (wParam == WM_LBUTTONDOWN || wParam == WM_LBUTTONUP)
                {
                    for (HWND hwnd : g_slaveWindows)
                    {
                        POINT clientPt = ConvertScreenToClient(hwnd, pMouseStruct->pt);
                        CallControlActionCallback("mouse-click-action");
                        PostMessage(hwnd, wParam, 0, MAKELPARAM(clientPt.x, clientPt.y));
                    }
                }
                else if (wParam == WM_MOUSEWHEEL)
                {
                    for (HWND hwnd : g_slaveWindows)
                    {
                        CallControlActionCallback("mouse-wheel-action");
                        PostMessage(hwnd, wParam, wParam, MAKELPARAM(pMouseStruct->pt.x, pMouseStruct->pt.y));
                    }
                }
            }
        }
    }
    return CallNextHookEx(NULL, nCode, wParam, lParam);
}

void ControlWindows(HWND masterWindow, const std::vector<HWND> &slaveWindows)
{
    g_masterWindow = masterWindow;
    g_slaveWindows = slaveWindows;

    g_keyboardHook = SetWindowsHookEx(WH_KEYBOARD_LL, KeyboardProc, NULL, 0);

    g_mouseHook = SetWindowsHookEx(WH_MOUSE_LL, MouseProc, NULL, 0);
}

void SetControlActionCallback(const Napi::CallbackInfo &info)
{
    Napi::Env env = info.Env();
    g_controlActionCallback = Napi::ThreadSafeFunction::New(
        env,
        info[0].As<Napi::Function>(),
        "ControlActionCallback",
        0,
        1);
}

Napi::String TileChromeWindows(const Napi::CallbackInfo &info)
{
    Napi::Env env = info.Env();

    TileWindows();

    return Napi::String::New(env, "Tiled Chrome windows");
}

Napi::String StartGroupControl(const Napi::CallbackInfo &info)
{
    Napi::Env env = info.Env();

    // 检查参数数量和类型
    if (info.Length() < 2 || !info[0].IsNumber() || !info[1].IsArray())
    {
        Napi::TypeError::New(env, "Expected master process ID and array of slave process IDs").ThrowAsJavaScriptException();
        return Napi::String::New(env, "Error");
    }

    DWORD masterProcessId = info[0].As<Napi::Number>().Uint32Value();
    Napi::Array slaveProcessIds = info[1].As<Napi::Array>();

    // 清除旧的窗口句柄
    chromeWindows.clear();

    // 查找主控窗口句柄
    EnumWindows(EnumWindowsProcByPid, (LPARAM)masterProcessId);
    if (chromeWindows.empty())
    {
        return Napi::String::New(env, "No master window found for the given process ID");
    }
    HWND masterWindow = chromeWindows[0];

    // 查找被控窗口句柄
    std::vector<HWND> slaveWindows;
    for (size_t i = 0; i < slaveProcessIds.Length(); ++i)
    {
        DWORD slaveProcessId = slaveProcessIds.Get(i).As<Napi::Number>().Uint32Value();
        chromeWindows.clear();
        EnumWindows(EnumWindowsProcByPid, (LPARAM)slaveProcessId);
        slaveWindows.insert(slaveWindows.end(), chromeWindows.begin(), chromeWindows.end());
    }

    ControlWindows(masterWindow, slaveWindows);

    return Napi::String::New(env, "Started group control");
}
void UninstallHooks()
{
    if (g_keyboardHook != NULL)
    {
        UnhookWindowsHookEx(g_keyboardHook);
        g_keyboardHook = NULL;
    }
    if (g_mouseHook != NULL)
    {
        UnhookWindowsHookEx(g_mouseHook);
        g_mouseHook = NULL;
    }
}

Napi::Object Init(Napi::Env env, Napi::Object exports)
{
    exports.Set("setControlActionCallback", Napi::Function::New(env, SetControlActionCallback));
    exports.Set("tileChromeWindows", Napi::Function::New(env, TileChromeWindows));
    exports.Set("startGroupControl", Napi::Function::New(env, StartGroupControl));
    return exports;
}

NODE_API_MODULE(windowAddon, Init)
