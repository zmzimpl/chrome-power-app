/**
 * Patch @tkomde/iohook package.json to add Electron 27 (ABI 118) support
 */
const fs = require('fs');
const path = require('path');

const iohookPath = path.join(__dirname, '../node_modules/@tkomde/iohook/package.json');

console.log('Patching @tkomde/iohook package.json...');

try {
  // Read package.json
  const packageJson = JSON.parse(fs.readFileSync(iohookPath, 'utf8'));

  // Check if iohook config exists
  if (!packageJson.iohook) {
    packageJson.iohook = {};
  }

  // Add or update targets to include electron-118 (Electron 27)
  if (!packageJson.iohook.targets) {
    packageJson.iohook.targets = [];
  }

  // Add electron-118 if not present
  if (!packageJson.iohook.targets.includes('electron-118')) {
    packageJson.iohook.targets.push('electron-118');
    console.log('Added electron-118 (Electron 27) to targets');
  }

  // Ensure platforms and arches are set
  if (!packageJson.iohook.platforms) {
    packageJson.iohook.platforms = ['win32', 'darwin', 'linux'];
  }

  if (!packageJson.iohook.arches) {
    packageJson.iohook.arches = ['x64', 'arm64'];
  }

  // Write back to file
  fs.writeFileSync(iohookPath, JSON.stringify(packageJson, null, 2), 'utf8');

  console.log('Successfully patched @tkomde/iohook package.json');
  console.log('Targets:', packageJson.iohook.targets);
  console.log('Platforms:', packageJson.iohook.platforms);
  console.log('Arches:', packageJson.iohook.arches);

  process.exit(0);
} catch (error) {
  console.error('Failed to patch @tkomde/iohook:', error.message);
  process.exit(1);
}
