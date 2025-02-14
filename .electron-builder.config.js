/**
 * TODO: Rewrite this config to ESM
 * But currently electron-builder doesn't support ESM configs
 * @see https://github.com/develar/read-config-file/issues/10
 */

/**
 * @type {() => import('electron-builder').Configuration}
 * @see https://www.electron.build/configuration/configuration
 */
module.exports = async function () {
  const {getVersion} = await import('./version/getVersion.mjs');
  return {
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
    ],
    extraResources: [
      {
        from: 'packages/main/src/native-addon/build/Release/',
        to: 'app.asar.unpacked/node_modules/window-addon/',
        filter: ['*.node'],
      },
      {
        from: 'migrations',
        to: 'app/migrations',
      },
      {
        from: 'assets',
        to: 'app/assets',
      },
    ],
    extraMetadata: {
      version: getVersion(),
    },
    asarUnpack: ['**/*.node'],

    // Windows 配置
    win: {
      target: ['nsis'],
      requestedExecutionLevel: 'requireAdministrator',
      icon: 'buildResources/icon.ico', // 确保此路径存在
    },
    nsis: {
      oneClick: false,
      allowElevation: true,
      allowToChangeInstallationDirectory: true,
      createDesktopShortcut: true,
      createStartMenuShortcut: true,
      shortcutName: 'Chrome Power',
    },

    // macOS 配置
    mac: {
      identity: process.env.APPLE_IDENTITY,
      target: ['dmg', 'zip'],
      category: 'public.app-category.developer-tools',
      icon: 'buildResources/icon.icns',
      hardenedRuntime: true,
      gatekeeperAssess: false,
      entitlements: 'buildResources/entitlements.mac.plist',
      entitlementsInherit: 'buildResources/entitlements.mac.plist',
      signIgnore: [
        'node_modules/sqlite3/lib/binding/napi-v6-darwin-unknown-arm64/node_sqlite3.node',
        'node_modules/sqlite3/lib/binding/napi-v6-darwin-unknown-x64/node_sqlite3.node',
      ],
      artifactName: '${productName}-${version}-${arch}.${ext}',
      compression: 'store',
      darkModeSupport: true,
    },
    dmg: {
      sign: false,
      writeUpdateInfo: false,
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
    afterSign: async context => {
      const {electronPlatformName, appOutDir} = context;
      if (electronPlatformName === 'darwin') {
        console.log('Signing completed for macOS');
        console.log('Output directory:', appOutDir);
      }
    },
  };
};
