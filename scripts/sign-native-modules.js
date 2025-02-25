const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

require('dotenv').config();

// 获取应用路径 - 同时检查 mac 和 mac-arm64 目录
let appPath;
const macPath = path.join(__dirname, '../dist/mac/Chrome Power.app');
const macArm64Path = path.join(__dirname, '../dist/mac-arm64/Chrome Power.app');

if (fs.existsSync(macArm64Path)) {
  appPath = macArm64Path;
  console.log('Using arm64 app path:', appPath);
} else if (fs.existsSync(macPath)) {
  appPath = macPath;
  console.log('Using regular mac app path:', appPath);
} else {
  console.error('应用路径不存在，请先构建应用');
  process.exit(1);
}

const identity = process.env.APPLE_IDENTITY;
const entitlements = path.join(__dirname, '../buildResources/entitlements.mac.plist');

console.log('Signing native modules...');

// 找到所有 .node 文件并单独签名
function signNativeModules(directory) {
  try {
    const files = fs.readdirSync(directory, { withFileTypes: true });
    for (const file of files) {
      const fullPath = path.join(directory, file.name);
      if (file.isDirectory()) {
        signNativeModules(fullPath);
      } else if (file.name.endsWith('.node')) {
        console.log(`Signing ${fullPath}`);
        try {
          execSync(`codesign --force --sign "${identity}" --timestamp --options runtime --entitlements "${entitlements}" --verbose "${fullPath}"`, { stdio: 'inherit' });
        } catch (err) {
          console.error(`Failed to sign ${fullPath}:`, err);
        }
      }
    }
  } catch (err) {
    console.error(`Error processing directory ${directory}:`, err);
  }
}

// 签名所有原生模块
const unpackedPath = path.join(appPath, 'Contents/Resources/app.asar.unpacked');
if (fs.existsSync(unpackedPath)) {
  signNativeModules(unpackedPath);
} else {
  console.error('app.asar.unpacked 目录不存在:', unpackedPath);
}

// 最后重新签名整个应用
console.log('Re-signing entire application...');
execSync(`codesign --force --sign "${identity}" --timestamp --options runtime --entitlements "${entitlements}" --verbose "${appPath}"`, { stdio: 'inherit' });

// 设置执行权限
console.log('设置执行权限...');
execSync(`chmod -R +x "${appPath}"`, { stdio: 'inherit' });
console.log(`特别设置主程序权限: ${appPath}/Contents/MacOS/Chrome Power`);
execSync(`chmod +x "${appPath}/Contents/MacOS/Chrome Power"`, { stdio: 'inherit' });

// 移除隔离属性
console.log('移除隔离属性...');
execSync(`xattr -dr com.apple.quarantine "${appPath}" || true`, { stdio: 'inherit' });

console.log('验证签名...');
execSync(`codesign --verify --deep --strict --verbose=2 "${appPath}"`, { stdio: 'inherit' });

// 签名所有二进制文件和框架
console.log('Signing all binaries and frameworks...');
const exePath = path.join(appPath, 'Contents/MacOS/Chrome Power');
const helperPath = path.join(appPath, 'Contents/Frameworks/Chrome Power Helper.app');
const helperEXEPath = path.join(appPath, 'Contents/Frameworks/Chrome Power Helper.app/Contents/MacOS/Chrome Power Helper');

// 签名 Electron Helper
if (fs.existsSync(helperPath)) {
  console.log(`Signing Electron Helper: ${helperPath}`);
  execSync(`codesign --force --sign "${identity}" --timestamp --options runtime --entitlements "${entitlements}" --verbose "${helperPath}"`, { stdio: 'inherit' });
  
  // 确保 Helper 有执行权限
  if (fs.existsSync(helperEXEPath)) {
    console.log(`Setting permissions for Helper: ${helperEXEPath}`);
    execSync(`chmod +x "${helperEXEPath}"`, { stdio: 'inherit' });
  }
}

// 确保主程序有执行权限
console.log(`Setting permissions for main executable: ${exePath}`);
execSync(`chmod +x "${exePath}"`, { stdio: 'inherit' });

// 签名其他框架
const frameworksPath = path.join(appPath, 'Contents/Frameworks');
if (fs.existsSync(frameworksPath)) {
  const frameworks = fs.readdirSync(frameworksPath);
  for (const framework of frameworks) {
    if (framework.endsWith('.framework') || framework.includes('.dylib')) {
      const frameworkPath = path.join(frameworksPath, framework);
      console.log(`Signing framework: ${frameworkPath}`);
      try {
        execSync(`codesign --force --sign "${identity}" --timestamp --options runtime --entitlements "${entitlements}" --verbose "${frameworkPath}"`, { stdio: 'inherit' });
      } catch (err) {
        console.error(`Failed to sign ${frameworkPath}:`, err);
      }
    }
  }
}

console.log('Done!');
