/**
 * TODO: Rewrite this config to ESM
 * But currently electron-builder doesn't support ESM configs
 * @see https://github.com/develar/read-config-file/issues/10
 */

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
        from: 'packages/main/src/native-addon/build/Release/',
        to: 'app.asar.unpacked/node_modules/window-addon/',
        filter: ['window-addon-x64.node', 'window-addon-arm64.node', 'window-addon.node'],
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
    asarUnpack: ['node_modules/sqlite3/**/*', '**/*.node'],

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
      artifactName: '${productName}-Setup-${version}.${ext}',
    },

    // macOS 配置
    mac: {
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
      signIgnore: [
        'node_modules/sqlite3/lib/binding/napi-v6-darwin-unknown-arm64/node_sqlite3.node',
        'node_modules/sqlite3/lib/binding/napi-v6-darwin-unknown-x64/node_sqlite3.node',
        'app.asar.unpacked/node_modules/window-addon/window-addon-x64.node',
        'app.asar.unpacked/node_modules/window-addon/window-addon-arm64.node',
      ],
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
      releaseType: 'draft',
    },
  };

  // 根据平台添加特定配置
  if (process.platform === 'darwin') {
    // 只在 CI 环境中启用签名
    if (process.env.CI) {
      config.mac = {
        icon: 'buildResources/icon.icns',
        identity: process.env.APPLE_IDENTITY,
        target: [
          {
            target: 'dmg',
            arch: ['x64', 'arm64'],
          },
        ],
        category: 'public.app-category.developer-tools',
        hardenedRuntime: true,
        gatekeeperAssess: true,
        entitlements: 'buildResources/entitlements.mac.plist',
        entitlementsInherit: 'buildResources/entitlements.mac.plist',
        signIgnore: [
          'node_modules/sqlite3/lib/binding/napi-v6-darwin-unknown-arm64/node_sqlite3.node',
          'node_modules/sqlite3/lib/binding/napi-v6-darwin-unknown-x64/node_sqlite3.node',
          'app.asar.unpacked/node_modules/window-addon/window-addon-x64.node',
          'app.asar.unpacked/node_modules/window-addon/window-addon-arm64.node',
        ],
        artifactName: '${productName}-${version}-${arch}-${os}-' + getBuildTime() + '.${ext}',
        compression: 'store',
        darkModeSupport: true,
      };
    }

    config.dmg = {
      sign: false,
      writeUpdateInfo: false,
      format: 'ULFO',
    };
  }

  return config;
};
