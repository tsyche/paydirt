import { PaydirtClient } from "@paydirt/shared";

// On a physical device, 127.0.0.1 is the device itself — set
// EXPO_PUBLIC_POCKETBASE_URL to your machine's LAN IP (e.g. http://192.168.1.50:8090).
// 10.0.2.2 is the Android emulator's alias for the host machine.
// For physical devices, set EXPO_PUBLIC_POCKETBASE_URL to your LAN IP.
const url = process.env.EXPO_PUBLIC_POCKETBASE_URL ?? "http://10.0.2.2:8090";

export const client = new PaydirtClient(url);
