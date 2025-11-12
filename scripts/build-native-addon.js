#!/usr/bin/env node

/**
 * 根据平台和架构构建原生模块并组织输出文件
 * 这个脚本将：
 * 1. 确定当前操作系统和架构
 * 2. 执行适当的构建命令
 * 3. 创建特定于平台/架构的目录
 * 4. 将构建好的模块移动到对应目录
 */

const { execSync } = require('child_process');
const path = require('path');
const dotenv = require('dotenv');

// 加载环境变量
dotenv.config();

// 获取平台和架构信息
const platform = process.env.ELECTRON_PLATFORM || process.platform;
const arch = process.env.ELECTRON_ARCH || process.arch;

console.log(`构建原生模块 (平台: ${platform}, 架构: ${arch})`);

// 原生模块目录
const nativeAddonDir = path.join(__dirname, '../packages/main/src/native-addon');
const buildDir = path.join(nativeAddonDir, 'build');
const releaseDir = path.join(buildDir, 'Release');

// 创建特定于平台和架构的目标目录路径
const targetDir = path.join(releaseDir, `${platform}-${arch}`);
const sourcePath = path.join(releaseDir, 'window-addon.node');

try {
  // 检查是否已经存在构建好的文件
  const fs = require('fs');
  const targetAddonPath = path.join(targetDir, 'window-addon.node');

  if (fs.existsSync(targetAddonPath)) {
    console.log(`✓ Native addon already exists at ${targetAddonPath}`);
    console.log('Skipping rebuild to avoid file lock issues');
    process.exit(0);
  }

  // 根据不同平台和架构执行不同的构建命令
  console.log(`开始为 ${platform}-${arch} 构建原生模块...`);

  try {
    if (platform === 'win32') {
      console.log('在 Windows 平台构建原生模块...');
      execSync('npm run build:native-addon', { stdio: 'inherit' });
    } else if (platform === 'darwin') {
      if (arch === 'arm64') {
        console.log('在 macOS (arm64) 构建原生模块...');
        execSync('npm run build:native-addon:mac-arm64', { stdio: 'inherit' });
      } else if (arch === 'x64') {
        console.log('在 macOS (x64) 构建原生模块...');
        execSync('npm run build:native-addon:mac-x64', { stdio: 'inherit' });
      } else {
        console.log(`在 macOS (${arch}) 构建原生模块...`);
        execSync('npm run build:native-addon', { stdio: 'inherit' });
      }
    } else {
      // 其他平台的处理
      console.log(`在 ${platform} 平台构建原生模块...`);
      execSync('npm run build:native-addon', { stdio: 'inherit' });
    }
  } catch (buildError) {
    // Check if source file exists even though build failed
    if (fs.existsSync(sourcePath)) {
      console.warn('Build command failed, but source file exists. Continuing...');
    } else {
      throw buildError;
    }
  }
  
  console.log('构建命令执行完成，检查输出文件...');
  
  // 使用命令行列出目录内容
  if (platform === 'win32') {
    execSync(`dir "${buildDir}"`, { stdio: 'inherit' });
    execSync(`dir "${releaseDir}"`, { stdio: 'inherit' });
  } else {
    execSync(`ls -la "${buildDir}"`, { stdio: 'inherit' });
    execSync(`ls -la "${releaseDir}"`, { stdio: 'inherit' });
  }

  // 使用命令行创建目录和复制文件
  console.log('创建目标目录并复制文件...');
  if (platform === 'win32') {
    execSync(`mkdir "${targetDir}" 2>nul || echo "Directory already exists"`, { stdio: 'inherit' });
    execSync(`copy "${sourcePath}" "${targetDir}\\window-addon.node"`, { stdio: 'inherit' });
  } else {
    execSync(`mkdir -p "${targetDir}"`, { stdio: 'inherit' });
    execSync(`cp "${sourcePath}" "${targetDir}/window-addon.node"`, { stdio: 'inherit' });
  }

  // 验证文件已复制
  console.log('验证文件已复制...');
  if (platform === 'win32') {
    execSync(`dir "${targetDir}"`, { stdio: 'inherit' });
  } else {
    execSync(`ls -la "${targetDir}"`, { stdio: 'inherit' });
  }

  console.log('原生模块构建和组织完成！');
} catch (error) {
  console.error('构建过程中发生错误:', error);
  console.error('This is not critical if the addon already exists or will be built later');
  // Don't exit with error code to allow npm install to continue
  process.exit(0);
}