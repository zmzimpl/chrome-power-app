/**
 * TODO: Rewrite this config to ESM
 * But currently electron-builder doesn't support ESM configs
 * @see https://github.com/develar/read-config-file/issues/10
 */

/**
 * @type {() => import('electron-builder').Configuration}
 * @see https://www.electron.build/configuration/configuration
 */
require('dotenv').config();
function getBuildTime() {
  return process.env.BUILD_TIME || new Date().getTime();
}

module.exports = async function () {
  const {getVersion} = await import('./version/getVersion.mjs');
  const config = {
    productName: 'Chrome Power',
    directories: {
      output: 'dist',
      buildResources: 'buildResources',
    },
    files: [
      'packages/**/dist/**',
      'packages/**/assets/**',
      'migrations',
      'node_modules/sqlite3/**/*',
      'buildResources/**/*',
      '!**/node_modules/*/{CHANGELOG.md,README.md,README,readme.md,readme}',
      '!**/node_modules/*/{test,__tests__,tests,powered-test,example,examples}',
    ],
    extraResources: [
      {
        from: 'migrations',
        to: 'app/migrations',
      },
      {
        from: 'assets',
        to: 'app/assets',
      },
      {
        from: 'buildResources',
        to: 'buildResources',
        filter: ['*.ico', '*.png', '*.icns'],
      },
    ],
    asar: true,
    asarUnpack: ['node_modules/sqlite3/**/*'],
  };

  config.extraResources.push({
    from: 'packages/main/src/native-addon/build/Release/',
    to: 'app.asar.unpacked/node_modules/window-addon/',
    filter: ['*.node'],
  });
  // // Windows 特定配置
  // if (process.platform === 'win32') {
  // }

  // macOS 特定配置
  if (process.platform === 'darwin') {
    config.asarUnpack.push('**/*.node');
  }

  config.extraMetadata = {
    version: getVersion(),
    main: './packages/main/dist/index.cjs',
  };

  // Windows 配置
  config.win = {
    icon: 'buildResources/icon.ico',
    target: [
      {
        target: 'nsis',
        arch: ['x64'],
      },
    ],
    artifactName: '${productName}-${version}-${arch}-${os}-' + getBuildTime() + '.${ext}',
  };
  config.nsis = {
    oneClick: false,
    allowElevation: true,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: 'Chrome Power',
    installerIcon: 'buildResources/icon.ico',
    uninstallerIcon: 'buildResources/icon.ico',
    installerHeaderIcon: 'buildResources/icon.ico',
    menuCategory: true,
    artifactName: '${productName}-Setup-${version}.${ext}',
  };

  // macOS 基础配置（本地构建使用）
  config.mac = {
    icon: 'buildResources/icon.icns',
    identity: null,
    target: [
      {
        target: 'dmg',
        arch: ['x64', 'arm64'],
      },
    ],
    category: 'public.app-category.developer-tools',
    hardenedRuntime: false,
    gatekeeperAssess: false,
    entitlements: null,
    entitlementsInherit: null,
    artifactName: '${productName}-${version}-${arch}-${os}-' + getBuildTime() + '.${ext}',
    compression: 'store',
    darkModeSupport: true,
  };
  config.dmg = {
    sign: false,
    writeUpdateInfo: false,
    format: 'ULFO',
  };
  // 自编译不需要签名也行
  // mac: {
  //   identity: null,
  //   target: ['dmg', 'zip'],
  //   category: 'public.app-category.developer-tools',
  //   icon: 'buildResources/icon.icns',
  //   hardenedRuntime: true,
  //   gatekeeperAssess: false,
  //   entitlements: 'buildResources/entitlements.mac.plist',
  //   entitlementsInherit: 'buildResources/entitlements.mac.plist'
  // },
  // dmg: {
  //   sign: false
  // },
  config.afterSign = async context => {
    const {electronPlatformName, appOutDir} = context;
    if (electronPlatformName === 'darwin') {
      console.log('Signing completed for macOS');
      console.log('Output directory:', appOutDir);
    }
  };

  // 添加 GitHub 发布配置
  config.publish = {
    provider: 'github',
    private: false,
    releaseType: 'draft',
  };

  return config;
};
