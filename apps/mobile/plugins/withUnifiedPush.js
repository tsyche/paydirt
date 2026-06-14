// Expo Config Plugin: wires up UnifiedPush support after expo prebuild.
//
// Applies three changes to the generated Android project:
//   1. Adds .UnifiedPushReceiver to AndroidManifest.xml with UP intent filters
//   2. Adds io.heckel.ntfy to <queries> for package visibility (Android 11+)
//   3. Copies native-src/UnifiedPushReceiver.kt into the app package directory
//   4. Patches MainApplication.kt to call registerWithNtfy() on startup
//
// Keep this plugin in sync with native-src/UnifiedPushReceiver.kt.
// The android/ directory is gitignored (generated); this plugin is the
// authoritative source for these native customisations.

const { withAndroidManifest, withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const NTFY_PACKAGE = "io.heckel.ntfy";
const RECEIVER_CLASS = ".UnifiedPushReceiver";
const UP_ACTIONS = [
  "org.unifiedpush.android.connector.NEW_ENDPOINT",
  "org.unifiedpush.android.connector.UNREGISTERED",
  "org.unifiedpush.android.connector.MESSAGE",
  "org.unifiedpush.android.connector.REGISTRATION_FAILED",
];

function addNtfyToQueries(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;

    if (!manifest.queries) manifest.queries = [{}];
    const queries = manifest.queries[0];
    if (!queries.package) queries.package = [];

    const already = queries.package.some((p) => p.$?.["android:name"] === NTFY_PACKAGE);
    if (!already) {
      queries.package.push({ $: { "android:name": NTFY_PACKAGE } });
    }

    return cfg;
  });
}

function addUpReceiver(config) {
  return withAndroidManifest(config, (cfg) => {
    const app = cfg.modResults.manifest.application[0];
    if (!app.receiver) app.receiver = [];

    const already = app.receiver.some((r) => r.$?.["android:name"] === RECEIVER_CLASS);
    if (already) return cfg;

    app.receiver.push({
      $: { "android:name": RECEIVER_CLASS, "android:exported": "true" },
      "intent-filter": [
        {
          action: UP_ACTIONS.map((name) => ({ $: { "android:name": name } })),
        },
      ],
    });

    return cfg;
  });
}

function addNativeFiles(config) {
  return withDangerousMod(config, [
    "android",
    (cfg) => {
      const platformRoot = cfg.modRequest.platformProjectRoot;
      const packageDir = path.join(
        platformRoot,
        "app/src/main/java/io/paydirt/app",
      );

      // Copy UnifiedPushReceiver.kt
      const srcKt = path.join(__dirname, "../native-src/UnifiedPushReceiver.kt");
      fs.copyFileSync(srcKt, path.join(packageDir, "UnifiedPushReceiver.kt"));

      // Patch MainApplication.kt — add registerWithNtfy(this) after
      // ApplicationLifecycleDispatcher.onApplicationCreate(this)
      const mainAppPath = path.join(packageDir, "MainApplication.kt");
      let src = fs.readFileSync(mainAppPath, "utf8");
      const anchor = "ApplicationLifecycleDispatcher.onApplicationCreate(this)";
      if (src.includes(anchor) && !src.includes("registerWithNtfy")) {
        src = src.replace(anchor, anchor + "\n    registerWithNtfy(this)");
        fs.writeFileSync(mainAppPath, src);
      }

      return cfg;
    },
  ]);
}

module.exports = (config) => {
  config = addNtfyToQueries(config);
  config = addUpReceiver(config);
  config = addNativeFiles(config);
  return config;
};
