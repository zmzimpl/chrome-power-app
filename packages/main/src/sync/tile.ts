import type {SafeAny} from '../../../shared/types/db';

let windowAddon: unknown;
import * as path from 'path';
if (process.env.MODE === 'development') {
  windowAddon = require(
    path.join(__dirname, '../src/native-addon/build/Release/window-addon.node'),
  );
} else {
  windowAddon = require(
    path.join(
      process.resourcesPath,
      'app.asar.unpacked',
      'node_modules',
      'window-addon',
      'window-addon.node',
    ),
  );
}
export const tileWindows = async () => {
  (windowAddon as unknown as SafeAny)!.tileChromeWindows();
};
