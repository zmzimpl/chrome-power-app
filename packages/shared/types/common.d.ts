export interface OperationResult {
  success: boolean;
  message: string;
  data?: SafeAny;
}

export interface SettingOptions {
  profileCachePath: string;
  useLocalChrome: boolean,
  localChromePath: string,
  chromiumBinPath: string,
}
