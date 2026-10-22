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
