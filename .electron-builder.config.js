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
      'buildResources/**/*',
      '!**/node_modules/*/{CHANGELOG.md,README.md,README,readme.md,readme}',
      '!**/node_modules/*/{test,__tests__,tests,powered-test,example,examples}',
    ],
    extraResources: [
      // {
      //   from: 'packages/main/src/native-addon/build/Release/',
      //   to: 'app.asar.unpacked/node_modules/window-addon/',
      //   filter: ['*.node'],
      // },
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
    asarUnpack: ['node_modules/sqlite3/**/*', '**/*.node'],

    // Windows 配置
    win: {
      icon: 'buildResources/icon.ico',
      requestedExecutionLevel: 'requireAdministrator',
      signAndEditExecutable: false,
      verifyUpdateCodeSignature: false,
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
      artifactName: '${productName}-Setup-${version}.${ext}',
    },

    // macOS 配置
    mac: {
      icon: 'buildResources/icon.icns',
      identity: process.env.APPLE_IDENTITY,
      target: ['dmg', 'zip'],
      category: 'public.app-category.developer-tools',
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
    afterSign: async context => {
      const {electronPlatformName, appOutDir} = context;
      if (electronPlatformName === 'darwin') {
        console.log('Signing completed for macOS');
        console.log('Output directory:', appOutDir);
      }
    },

    // 添加 GitHub 发布配置
    publish: {
      provider: 'github',
      private: false,
      releaseType: 'release',
    },
  };
};
