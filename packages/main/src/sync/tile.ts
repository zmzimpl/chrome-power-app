import type {SafeAny} from '../../../shared/types/db';

let windowAddon: unknown;

console.log(process.env.NODE_ENV);
if (process.env.NODE_ENV === 'production') {
  windowAddon = require('../native-addon/build/Release/window-addon.node');
} else {
  const path = require('path');
  windowAddon = require(path.join(
    __dirname,
    '../src/native-addon/build/Release/window-addon.node',
  ));
}
export const tileWindows = async () => {
  (windowAddon as unknown as SafeAny)!.tileChromeWindows();
};
