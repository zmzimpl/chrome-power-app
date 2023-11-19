import type {SafeAny} from '../../../shared/types/db';

let windowAddon: unknown;

if (process.env.NODE_ENV === 'development') {
  const path = require('path');
  windowAddon = require(path.join(
    __dirname,
    '../src/native-addon/build/Release/window-addon.node',
  ));
} else {
  windowAddon = require('../native-addon/build/Release/window-addon.node');
}
export const tileWindows = async () => {
  (windowAddon as unknown as SafeAny)!.tileChromeWindows();
};
