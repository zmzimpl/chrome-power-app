export type DataStore = {
  membership?: SafeAny;
  session?: SafeAny;
};

export interface OperationResult {
  success: boolean;
  message: string;
  data?: SafeAny;
}

export interface SettingOptions {
  profileCachePath: string;
}
