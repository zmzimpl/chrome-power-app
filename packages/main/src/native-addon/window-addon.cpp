#include <napi.h>
#include <windows.h>
#include <vector>

std::vector<HWND> chromeWindows;
int screenWidth, screenHeight;

BOOL CALLBACK EnumWindowsProc(HWND hwnd, LPARAM lParam) {
    const DWORD TITLE_SIZE = 1024;
    WCHAR windowTitle[TITLE_SIZE];

    GetWindowTextW(hwnd, windowTitle, TITLE_SIZE);

    int length = ::GetWindowTextLength(hwnd);
    std::wstring title(&windowTitle[0]);
    if (!IsWindowVisible(hwnd) || length == 0 || title.find(L"By ChromePower") == std::wstring::npos) {
        return TRUE;
    }

    chromeWindows.push_back(hwnd);
    return TRUE;
}

void TileWindows() {
    chromeWindows.clear();

    screenWidth = GetSystemMetrics(SM_CXSCREEN);
    screenHeight = GetSystemMetrics(SM_CYSCREEN);

    EnumWindows(EnumWindowsProc, NULL);

    int numWindows = chromeWindows.size();
    int rows = ceil(sqrt(numWindows));
    int cols = ceil((double)numWindows / rows);
    int windowWidth = screenWidth / cols;
    int windowHeight = screenHeight / rows;

    for (size_t i = 0; i < chromeWindows.size(); i++) {
        int col = i % cols;
        int row = i / cols;
        MoveWindow(chromeWindows[i], col * windowWidth, row * windowHeight, windowWidth, windowHeight, TRUE);

        SetForegroundWindow(chromeWindows[i]);
    }
}

Napi::String TileChromeWindows(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    TileWindows();

    return Napi::String::New(env, "Tiled Chrome windows");
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
    exports.Set(
        Napi::String::New(env, "tileChromeWindows"),
        Napi::Function::New(env, TileChromeWindows)
    );

    return exports;
}

NODE_API_MODULE(windowAddon, Init)
