import { NativeModules } from "react-native";

export interface LatestVersion {
  versionCode: number;
  versionName: string;
  downloadUrl: string;
}

export function parseVersionCode(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

export function shouldUpdate(installedCode: number, latestCode: number): boolean {
  return parseVersionCode(latestCode) > parseVersionCode(installedCode);
}

export async function fetchLatestVersion(
  pbUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<LatestVersion | null> {
  try {
    const res = await fetchImpl(`${pbUrl.replace(/\/$/, "")}/api/updates/version`);
    if (!res.ok) return null;
    const data = await res.json();
    return {
      versionCode: parseVersionCode(data.versionCode),
      versionName: String(data.versionName || ""),
      downloadUrl: String(data.downloadUrl || ""),
    };
  } catch {
    return null;
  }
}

// True when the installed build is newer than the one last seen on this device
// (null = first run, nothing to announce).
export function justUpdated(lastSeen: number | null, installed: number): boolean {
  return lastSeen !== null && installed > lastSeen;
}

// Triggers the system DownloadManager to fetch + install the APK. Returns true
// if the native call was dispatched. The OS handles the install prompt.
export async function triggerApkDownload(downloadUrl: string): Promise<boolean> {
  try {
    const native = NativeModules.PayDirtNative as
      | { downloadAndInstallApk?: (url: string) => Promise<boolean> }
      | undefined;
    if (native?.downloadAndInstallApk) {
      await native.downloadAndInstallApk(downloadUrl);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

// Maps a DownloadManager failure reason to something a parent can act on.
// 1006 = no space, 1004/1002/1005 = network/HTTP trouble, 1001/1007/1008 = file/storage, 4xx/5xx = HTTP status.
export function describeDownloadFailure(reason: number): string {
  if (reason === 1006) return "The device is out of storage. Free some space and try again.";
  if (reason === 1007) return "No storage is available (is the device plugged in to a computer?). Try again.";
  if (reason === 1001 || reason === 1008) return "The download could not be saved or resumed. Try again.";
  if (reason >= 400 && reason < 600) return `The update server answered ${reason}. The new build may not be published yet; try again later.`;
  if (reason === 1002 || reason === 1004 || reason === 1005 || reason === 1009)
    return "The download was interrupted or the server could not be reached. Check Wi-Fi and try again.";
  return "The download failed. Check Wi-Fi and storage, then try again.";
}

// Reads (and clears) a download failure recorded while the app wasn't listening; 0 = none.
export async function takeUpdateFailure(): Promise<number> {
  try {
    const native = NativeModules.PayDirtNative as { takeUpdateFailure?: () => Promise<number> } | undefined;
    return (await native?.takeUpdateFailure?.()) ?? 0;
  } catch {
    return 0;
  }
}

// Convenience: installed version code from expo-application when available.
export async function getInstalledVersionCode(): Promise<number> {
  try {
    const app = await import("expo-application");
    const v = (app as { nativeBuildVersion?: string | number }).nativeBuildVersion;
    return parseVersionCode(v);
  } catch {
    return 0;
  }
}
