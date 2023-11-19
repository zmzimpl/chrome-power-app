import type {DataStore} from '../types/common';
import type {SafeAny} from '../types/db';

const sharedData: Record<string, SafeAny> = {};

export const dataStore = {
  set(key: keyof DataStore, value: unknown) {
    sharedData[key] = value;
  },
  get(key: keyof DataStore) {
    return sharedData[key];
  },
  delete(key: keyof DataStore) {
    delete sharedData[key];
  },
  getAll() {
    return sharedData;
  },
};
