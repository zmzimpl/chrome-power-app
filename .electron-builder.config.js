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
    productName: 'chrome-power-beta',
    directories: {
      output: 'dist',
      buildResources: 'buildResources',
    },
    files: ['packages/**/dist/**', 'packages/**/assets/**', 'migrations'],
    extraResources:     {
      "from": "packages/main/src/native-addon/build/Release/",
      "to": "app/packages/main/native-addon/build/Release/",
      "filter": [
        "*.node"
      ]
    },
    extraMetadata: {
      version: getVersion(),
    },

    nsis: {
      oneClick: false,
      allowElevation: true,
      allowToChangeInstallationDirectory: true,
      createDesktopShortcut: true,
      createStartMenuShortcut: true,
      shortcutName: 'chrome-power-beta',
    },

    // Specify linux target just for disabling snap compilation
    linux: {
      target: 'deb',
    },
  };
};
