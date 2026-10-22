import AsyncStorage from "@react-native-async-storage/async-storage";

export const NTFY_CONFIG_KEY = "ntfy_config";

// v2 = topic subscribed via ntfy:// deep link AND a test delivery confirmed.
// Configs saved by the old wizard carry no version and count as incomplete —
// the old flow never subscribed the user's topic, so its "done" was meaningless.
export const SETUP_VERSION = 2;

export interface NtfyConfig {
  endpoint: string;
  isSetup: boolean;
  version?: number;
}

export const DEFAULT_CONFIG: NtfyConfig = {
  endpoint: "https://ntfy.sh",
  isSetup: false,
};

export function isSetupComplete(config: NtfyConfig | null | undefined): boolean {
  return !!config?.isSetup && (config.version ?? 0) >= SETUP_VERSION;
}

export async function getNtfyConfig(): Promise<NtfyConfig> {
  try {
    const stored = await AsyncStorage.getItem(NTFY_CONFIG_KEY);
    if (stored) return JSON.parse(stored) as NtfyConfig;
  } catch {
    // fall through to default
  }
  return DEFAULT_CONFIG;
}

export async function saveNtfyConfig(config: NtfyConfig): Promise<void> {
  await AsyncStorage.setItem(NTFY_CONFIG_KEY, JSON.stringify(config));
}

export async function setNtfySetupDone(endpoint: string): Promise<void> {
  await saveNtfyConfig({ endpoint, isSetup: true, version: SETUP_VERSION });
}

// ntfy://<host>/<topic> opens the ntfy Android app on the topic's detail view and
// subscribes to it if not already subscribed (docs.ntfy.sh/subscribe/phone).
// Plain http:// servers need secure=false, per the same docs.
export function buildSubscribeLink(
  endpoint: string,
  topic: string,
  displayName = "PayDirt",
): string {
  const host = endpoint.replace(/^https?:\/\//, "").replace(/\/+$/, "");
  const params = [`display=${encodeURIComponent(displayName)}`];
  if (endpoint.startsWith("http://")) params.push("secure=false");
  return `ntfy://${host}/${encodeURIComponent(topic)}?${params.join("&")}`;
}

export function buildTestUrl(endpoint: string, topic: string): string {
  return `${endpoint.replace(/\/+$/, "")}/${encodeURIComponent(topic)}`;
}

// Topic = the password for a public ntfy topic, so mix several Math.random
// chunks (crypto.getRandomValues isn't available in Hermes). Good enough for
// a household-scoped notification topic.
export function makeTopic(): string {
  const chunk = () => Math.random().toString(36).slice(2, 12);
  return `paydirt-${chunk()}${chunk()}${chunk()}`;
}

export function ensureTopic(existing?: string | null): string {
  const trimmed = (existing ?? "").trim();
  return trimmed || makeTopic();
}
