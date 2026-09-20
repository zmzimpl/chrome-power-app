import { exec } from 'child_process';
import { app } from 'electron';
import { promisify } from 'util';
import { platform } from 'process';

const execAsync = promisify(exec);
const APP_NAME = 'ChromePowerBrowser';

function buildScript(lines: string[]) {
  return lines.join('\n');
}

export async function registerAsDefaultBrowser(): Promise<{ success: boolean; message: string }> {
  if (platform !== 'win32') return { success: false, message: 'Only supported on Windows' };

  const exePath = app.getPath('exe').replace(/\\/g, '\\\\');

  const script = buildScript([
    `$cmd = '"${exePath}" --open-url "%1"'`,
    `$httpPath = "HKCU:\\Software\\Classes\\ChromeHTML\\shell\\open\\command"`,
    `New-Item -Path $httpPath -Force | Out-Null`,
    `Set-ItemProperty -Path $httpPath -Name "(default)" -Value $cmd -Force`,
    `$hpid = (Get-ItemProperty "HKCU:\\Software\\Microsoft\\Windows\\Shell\\Associations\\UrlAssociations\\https\\UserChoice" -ErrorAction SilentlyContinue).ProgId`,
    `if ($hpid) { $p = "HKCU:\\Software\\Classes\\$hpid\\shell\\open\\command"; New-Item -Path $p -Force | Out-Null; Set-ItemProperty -Path $p -Name "(default)" -Value $cmd -Force }`,
    `$cap = "HKCU:\\Software\\Clients\\StartMenuInternet\\${APP_NAME}\\Capabilities"`,
    `New-Item -Path $cap -Force | Out-Null`,
    `Set-ItemProperty -Path $cap -Name "ApplicationName" -Value "Chrome Power" -Force`,
    `$ua = "$cap\\URLAssociations"; New-Item -Path $ua -Force | Out-Null`,
    `Set-ItemProperty -Path $ua -Name "http" -Value "ChromeHTML" -Force`,
    `Set-ItemProperty -Path $ua -Name "https" -Value "ChromeHTML" -Force`,
    `Set-ItemProperty -Path "HKCU:\\Software\\RegisteredApplications" -Name "${APP_NAME}" -Value "Software\\Clients\\StartMenuInternet\\${APP_NAME}\\Capabilities" -Force`,
    `Write-Output "OK"`,
  ]);

  try {
    const { stdout } = await execAsync(
      `powershell.exe -ExecutionPolicy Bypass -NonInteractive -Command "${script.replace(/\n/g, '; ')}"`,
      { timeout: 15000 },
    );
    return stdout.includes('OK')
      ? { success: true, message: 'Registered as default browser' }
      : { success: false, message: 'Registration failed' };
  } catch (e) {
    return { success: false, message: String(e) };
  }
}

export async function unregisterAsDefaultBrowser(): Promise<{ success: boolean; message: string }> {
  if (platform !== 'win32') return { success: false, message: 'Only supported on Windows' };

  const script = buildScript([
    `Remove-Item -Path "HKCU:\\Software\\Classes\\ChromeHTML\\shell\\open\\command" -Force -ErrorAction SilentlyContinue`,
    `$hpid = (Get-ItemProperty "HKCU:\\Software\\Microsoft\\Windows\\Shell\\Associations\\UrlAssociations\\https\\UserChoice" -ErrorAction SilentlyContinue).ProgId`,
    `if ($hpid) { Remove-Item -Path "HKCU:\\Software\\Classes\\$hpid\\shell\\open\\command" -Force -ErrorAction SilentlyContinue }`,
    `Remove-Item -Path "HKCU:\\Software\\Clients\\StartMenuInternet\\${APP_NAME}" -Recurse -Force -ErrorAction SilentlyContinue`,
    `Remove-ItemProperty -Path "HKCU:\\Software\\RegisteredApplications" -Name "${APP_NAME}" -ErrorAction SilentlyContinue`,
    `Write-Output "OK"`,
  ]);

  try {
    await execAsync(
      `powershell.exe -ExecutionPolicy Bypass -NonInteractive -Command "${script.replace(/\n/g, '; ')}"`,
      { timeout: 15000 },
    );
    return { success: true, message: 'Unregistered successfully' };
  } catch (e) {
    return { success: false, message: String(e) };
  }
}

export async function isRegisteredAsDefaultBrowser(): Promise<boolean> {
  if (platform !== 'win32') return false;
  try {
    const { stdout } = await execAsync(
      `powershell.exe -NonInteractive -Command "(Get-ItemProperty 'HKCU:\\Software\\Classes\\ChromeHTML\\shell\\open\\command' -ErrorAction SilentlyContinue).'(default)'"`,
      { timeout: 5000 },
    );
    return stdout.includes('--open-url');
  } catch {
    return false;
  }
}