/**
 * Fix @tkomde/iohook binary path after electron-rebuild
 * electron-rebuild puts the binary in bin/win32-x64-118/iohook.node
 * but the library looks for it in builds/electron-v118-win32-x64/build/Release/iohook.node
 */
const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const iohookDir = path.join(rootDir, 'node_modules/@tkomde/iohook');

// Detect platform
const platform = process.platform === 'win32' ? 'win32' : process.platform === 'darwin' ? 'darwin' : 'linux';
const arch = process.arch;

// Source path (where electron-rebuild puts it)
const sourcePath = path.join(iohookDir, 'bin', `${platform}-${arch}-118`, 'iohook.node');

// Target path (where the library expects it)
const targetDir = path.join(iohookDir, 'builds', `electron-v118-${platform}-${arch}`, 'build', 'Release');
const targetPath = path.join(targetDir, 'iohook.node');

console.log('Fixing @tkomde/iohook binary path...');
console.log(`Platform: ${platform}-${arch}`);
console.log(`Source: ${sourcePath}`);
console.log(`Target: ${targetPath}`);

try {
  // Check if source exists
  if (!fs.existsSync(sourcePath)) {
    console.warn(`Warning: Source binary not found at ${sourcePath}`);
    console.warn('This might be normal if @tkomde/iohook was installed with prebuilt binaries.');

    // Check if target already exists (prebuilt)
    if (fs.existsSync(targetPath)) {
      console.log('Target binary already exists (probably prebuilt). No action needed.');
      process.exit(0);
    }

    console.error('Error: Neither source nor target binary exists. Please rebuild @tkomde/iohook.');
    process.exit(1);
  }

  // Create target directory structure
  fs.mkdirSync(targetDir, { recursive: true });

  // Copy the binary file
  fs.copyFileSync(sourcePath, targetPath);

  console.log('✓ Successfully copied binary to expected location');
  console.log(`✓ Binary is now at: ${targetPath}`);

  process.exit(0);
} catch (error) {
  console.error('Failed to fix iohook binary path:', error.message);
  process.exit(1);
}
