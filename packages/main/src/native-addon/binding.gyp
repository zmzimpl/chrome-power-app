{
  "targets": [
    {
      "target_name": "window-addon",
      "sources": [ "window-addon.cpp" ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")"
      ],
      "dependencies": ["<!(node -p \"require('node-addon-api').gyp\")"],
      "defines": [ "NAPI_DISABLE_CPP_EXCEPTIONS" ],
      "conditions": [
        ['OS=="mac"', {
          "xcode_settings": {
            "OTHER_CPLUSPLUSFLAGS": [
              "-std=c++17",
              "-stdlib=libc++",
              "-ObjC++",
              "-I/usr/local/include",
              "-I/opt/homebrew/include"
            ],
            "OTHER_LDFLAGS": [
              "-framework CoreFoundation",
              "-framework CoreGraphics",
              "-framework Cocoa",
              "-L/usr/local/lib",
              "-L/opt/homebrew/lib"
            ],
            "MACOSX_DEPLOYMENT_TARGET": "10.13",
            "GCC_ENABLE_CPP_EXCEPTIONS": "YES",
            "CLANG_CXX_LIBRARY": "libc++",
            "CLANG_CXX_LANGUAGE_STANDARD": "c++17",
            "SDKROOT": "macosx",
            "VALID_ARCHS": "x86_64 arm64",
            "CLANG_ENABLE_OBJC_ARC": "YES"
          },
          "include_dirs": [
            "/System/Library/Frameworks/CoreFoundation.framework/Headers",
            "/System/Library/Frameworks/CoreGraphics.framework/Headers",
            "/System/Library/Frameworks/Cocoa.framework/Headers",
            "/System/Library/Frameworks/Foundation.framework/Headers",
            "/System/Library/Frameworks/AppKit.framework/Headers"
          ]
        }],
        ['OS=="win"', {
          "msvs_settings": {
            "VCCLCompilerTool": {
              "ExceptionHandling": 1
            }
          }
        }]
      ]
    }
  ]
}