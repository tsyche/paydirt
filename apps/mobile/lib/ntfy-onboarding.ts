import AsyncStorage from "@react-native-async-storage/async-storage";

export const NTFY_CONFIG_KEY = "ntfy_config";
export const NTFY_ENDPOINT_KEY = "ntfy_endpoint";
export const NTFY_SETUP_DONE_KEY = "ntfy_setup_done";

export interface NtfyConfig {
  endpoint: string;
  isSetup: boolean;
}

export const DEFAULT_CONFIG: NtfyConfig = {
  endpoint: "https://ntfy.sh",
  isSetup: false,
};

export async function getNtfyConfig(): Promise<NtfyConfig> {
  try {
    const stored = await AsyncStorage.getItem(NTFY_CONFIG_KEY);
    if (stored) return JSON.parse(stored);
  } catch {
    // fall through to default
  }
  return DEFAULT_CONFIG;
}

export async function saveNtfyConfig(config: NtfyConfig): Promise<void> {
  await AsyncStorage.setItem(NTFY_CONFIG_KEY, JSON.stringify(config));
}

export async function setNtfySetupDone(endpoint: string): Promise<void> {
  const config: NtfyConfig = { endpoint, isSetup: true };
  await saveNtfyConfig(config);
}
