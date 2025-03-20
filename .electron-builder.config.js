/**
 * TODO: Rewrite this config to ESM
 * But currently electron-builder doesn't support ESM configs
 * @see https://github.com/develar/read-config-file/issues/10
 */
// const { notarize } = require('@electron/notarize');

require('dotenv').config();

/**
 * @type {() => import('electron-builder').Configuration}
 * @see https://www.electron.build/configuration/configuration
 */
function getBuildTime() {
  return process.env.BUILD_TIME || new Date().getTime();
}

module.exports = async function () {
  const {getVersion} = await import('./version/getVersion.mjs');
  const config = {
    productName: 'Chrome Power',
    appId: 'com.chrome-power.app',
    directories: {
      output: 'dist',
      buildResources: 'buildResources',
    },
    files: [
      'packages/**/dist/**',
      'packages/**/assets/**',
      'migrations',
      'package.json',
      'node_modules/sqlite3/lib/binding/**/*.node',
      'node_modules/iconv-corefoundation/lib/*.node',
      'buildResources/**/*',
    ],
    extraResources: [
      {
        from: `packages/main/src/native-addon/build/Release/${process.platform}-${process.arch}/`,
        to: 'app.asar.unpacked/node_modules/window-addon/',
        filter: ['window-addon.node'],
      },
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
    extraMetadata: {
      version: getVersion(),
      main: './packages/main/dist/index.cjs',
    },
    asar: true,
    asarUnpack: '**/*.{node,dll}',

    // Windows 配置
    win: {
      icon: 'buildResources/icon.ico',
      target: [
        {
          target: 'nsis',
          arch: ['x64'],
        },
      ],
      artifactName: '${productName}-${version}-${arch}-${os}-' + getBuildTime() + '.${ext}',
    },
    nsis: {
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
      artifactName: '${productName}-${version}-${arch}-${os}-' + getBuildTime() + '.${ext}',
    },

    // macOS 配置
    mac: {
      timestamp: false,
      icon: 'buildResources/icon.icns',
      notarize: false,
      identity: process.env.APPLE_IDENTITY,
      target: [
        {
          target: 'dmg',
          arch: ['x64', 'arm64'],
        },
      ],
      category: 'public.app-category.developer-tools',
      hardenedRuntime: true, 
      gatekeeperAssess: false,
      entitlements: 'buildResources/entitlements.mac.plist',
      entitlementsInherit: 'buildResources/entitlements.mac.plist',
      type: 'distribution',
      strictVerify: false,
      artifactName: '${productName}-${version}-${arch}-${os}' + getBuildTime() + '.${ext}',
      signIgnore: [],
    },
    dmg: {
      sign: false,
      writeUpdateInfo: false,
      format: 'ULFO',
    },
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
    // afterSign: async context => {
    //   const { electronPlatformName, appOutDir } = context;
    //   if (electronPlatformName === 'darwin') {
    //     const appName = context.packager.appInfo.productFilename;

    //     return await notarize({
    //       tool: 'notarytool',
    //       identity: process.env.APPLE_IDENTITY,
    //       teamId: process.env.APPLE_TEAM_ID,
    //       appBundleId: 'com.chrome-power.app',
    //       appPath: `${appOutDir}/${appName}.app`,
    //       appleId: process.env.APPLE_ID,
    //       appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
    //     });
    //   }
    // },

    // 添加 GitHub 发布配置
    publish: {
      provider: 'github',
      private: false,
      releaseType: 'draft',
    },
  };

  // 根据平台添加特定配置
  // if (process.platform === 'darwin') {
  //   // 只在 CI 环境中启用签名
  //   if (process.env.CI) {
  //     console.log('Signing for macOS in CI');
  //     config.mac = {
  //       icon: 'buildResources/icon.icns',
  //       identity: process.env.APPLE_IDENTITY,
  //       target: [
  //         {
  //           target: 'dmg',
  //           arch: ['x64', 'arm64'],
  //         },
  //       ],
  //       category: 'public.app-category.developer-tools',
  //       hardenedRuntime: true,
  //       gatekeeperAssess: true,
  //       entitlements: 'buildResources/entitlements.mac.plist',
  //       entitlementsInherit: 'buildResources/entitlements.mac.plist',
  //       signIgnore: [
  //         'node_modules/sqlite3/lib/binding/napi-v6-darwin-unknown-arm64/node_sqlite3.node',
  //         'node_modules/sqlite3/lib/binding/napi-v6-darwin-unknown-x64/node_sqlite3.node',
  //         'app.asar.unpacked/node_modules/window-addon/window-addon-x64.node',
  //         'app.asar.unpacked/node_modules/window-addon/window-addon-arm64.node',
  //       ],
  //       artifactName: '${productName}-${version}-${arch}-${os}-' + getBuildTime() + '.${ext}',
  //       compression: 'store',
  //       darkModeSupport: true,
  //     };
  //   }
    
  //   config.dmg = {
  //     sign: false,
  //     writeUpdateInfo: false,
  //     format: 'ULFO',
  //   };
  // }

  return config;
};