// Static app.json is kept for non-Expo tooling; this dynamic config layers on
// the expo-updates block so `updates.url` can point at this machine's PocketBase
// (LAN IP from EXPO_PUBLIC_POCKETBASE_URL, same var the client uses).
//
// runtimeVersion policy "appVersion" ties OTA updates to the semver in app.json
// — bump `version` for any native change (new APK required); pure JS/TS changes
// can ship via `just update-publish` without a version bump.
import base from "./app.json";

const pbUrl = process.env.EXPO_PUBLIC_POCKETBASE_URL || "http://10.0.2.2:3111";

export default {
  ...base.expo,
  runtimeVersion: {
    policy: "appVersion",
  },
  updates: {
    // Manifest endpoint served by pocketbase/pb_hooks/updates.pb.js
    url: `${pbUrl.replace(/\/$/, "")}/api/updates/manifest`,
    checkAutomatically: "ON_LOAD",
    fallbackToCacheTimeout: 0,
  },
};
