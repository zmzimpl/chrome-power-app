cmake_minimum_required(VERSION 3.15)
project(window_addon)

if(MSVC)
    add_compile_options(/utf-8)
endif()

# 设置 C++ 标准
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# 查找 Node.js 依赖
execute_process(COMMAND node -p "require('node-addon-api').include"
    WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}
    OUTPUT_VARIABLE NODE_ADDON_API_DIR
    OUTPUT_STRIP_TRAILING_WHITESPACE
)

execute_process(
    COMMAND node -e "console.log(process.versions.node)"
    OUTPUT_VARIABLE NODE_VERSION
    OUTPUT_STRIP_TRAILING_WHITESPACE
)

execute_process(
    COMMAND node -p "process.execPath"
    OUTPUT_VARIABLE NODE_EXECUTABLE_PATH
    OUTPUT_STRIP_TRAILING_WHITESPACE
)

get_filename_component(NODE_DIR ${NODE_EXECUTABLE_PATH} DIRECTORY)

string(REPLACE "\"" "" NODE_ADDON_API_DIR ${NODE_ADDON_API_DIR})

# 添加头文件路径
include_directories(
    ${NODE_ADDON_API_DIR}
    ${NODE_DIR}/../include/node
)

# 添加源文件
add_library(${PROJECT_NAME} SHARED
    window-addon.cpp
)

# 设置目标属性
set_target_properties(${PROJECT_NAME} PROPERTIES
    PREFIX ""
    SUFFIX ".node"
)

# 根据平台添加不同的链接库
if(WIN32)
    target_link_libraries(${PROJECT_NAME} PRIVATE)
elseif(APPLE)
    target_link_libraries(${PROJECT_NAME} PRIVATE
        "-framework CoreFoundation"
        "-framework ApplicationServices"
    )
endif()

# 定义 NAPI_VERSION
target_compile_definitions(${PROJECT_NAME} PRIVATE
    NAPI_VERSION=8
)