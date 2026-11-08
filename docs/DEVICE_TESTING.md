# Physical Device Testing

**TL;DR:** Pair each tablet once, list its IP in `deploy-devices` (`just conn` pins port 5555), then `just ship` (or `just push` for an adb-only install). This guide records the 2026-10-21 Pixel 8 / GrapheneOS smoke test and the 2026-11-06 API 34 emulator acceptance.

## Contents

- [One-time device setup](#one-time-device-setup)
- [Wireless push (no cable after initial pairing)](#wireless-push-no-cable-after-initial-pairing)
- [Build the APK](#build-the-apk)
- [Test checklist](#test-checklist)
- [API 34 emulator acceptance (2026-11-06)](#api-34-emulator-acceptance-2026-11-06)
- [Findings (2026-10-21 smoke test, Pixel 8 / GrapheneOS)](#findings-2026-10-21-smoke-test-pixel-8--grapheneos)
- [Useful adb commands](#useful-adb-commands)
- [Rebuilding after code changes](#rebuilding-after-code-changes)
- [In-app updates (no adb)](#in-app-updates-no-adb)

Guide for testing on a real Android device (GrapheneOS / LineageOS).

The app is distributed as a sideloaded APK — no Play Store, no Expo Go.
Notifications appear as **PayDirt** notifications (not ntfy). Kids do not need
to install any extra apps.

## One-time device setup

1. Enable Developer Options: Settings → About → tap Build Number 7 times
2. Enable USB Debugging: Settings → System → Developer Options → USB Debugging
3. Connect device via USB and trust the computer when prompted

```bash
adb devices   # should show the device as "device" (not "unauthorized")
```

If it shows `unauthorized`, revoke USB debugging auth on the device and reconnect.

## Wireless push (no cable after initial pairing)

One-time pairing per device (same Wi-Fi/network as the Mac):

1. On the device: Settings → Developer Options → Wireless Debugging → enable
2. Tap "Pair device with pairing code", then on the Mac:
   ```bash
   adb pair <ip>:<pair-port> <pairing-code>
   ```
3. Save the device to `deploy-devices` in the repo root, one per line. A bare IP
   is enough (`ip:port` also works). `just conn` connects on the Wireless debugging
   port and pins the fixed port 5555 automatically (survives sleep, not a reboot):
   ```
   192.168.20.152
   ```

After that, every update is one command from the Mac:

```bash
just conn          # connect every deploy-devices entry (no build/install)
just push-remote   # connect, build the release APK, install on all (alias: just push)
```

Notes:

- `scripts/tablet-connect.sh` tries each entry as written, then `ip:5555`, then mDNS.
- `just conn` skips unavailable/offline devices and exits successfully, even if
  none are reachable. Missing configuration remains an error; install commands
  separately check that a device is connected.
- A device **reboot** drops the pinned port and the random Wireless-debugging
  port changes: re-enable Wireless debugging and run `just conn` (list the new
  `ip:port` once if the bare IP fails); it re-pins 5555.
- `DEPLOY_DEVICES="ip:port ip:port" just push-remote` overrides the file.
- mDNS auto-discovery (no config file) only works on the same network segment;
  across VLANs the explicit `ip:port` entries are required, with the router
  allowing Mac → device on the pairing/debug port.
- Devices must be on the same network for the initial `adb pair` (code is shown
  on-device). Re-pairing is only needed if the device forgets the Mac.

## Build the APK

### 1. Set the server URL

Create `apps/mobile/.env` with your PocketBase server address:

```bash
# LAN IP (find with: ipconfig getifaddr en0 on macOS Wi-Fi)
echo "EXPO_PUBLIC_POCKETBASE_URL=http://192.168.1.50:3111" > apps/mobile/.env

# Or use adb reverse (USB tunnel) and keep 127.0.0.1:
just adb-tunnel
echo "EXPO_PUBLIC_POCKETBASE_URL=http://127.0.0.1:3111" > apps/mobile/.env
```

### 2. Build APK

`apps/mobile/android/` is committed (it has custom Kotlin), so a fresh clone
needs no prebuild.

```bash
just build-apk   # builds the debug APK (~2-3 min first time, faster after)
```

Requires: JDK 17+ and Android SDK. If not installed, Android Studio includes both
(`sdkmanager` → install "Android SDK Platform 34" and "Android SDK Build-Tools").

Set `ANDROID_HOME` if Gradle can't find the SDK:
```bash
export ANDROID_HOME=$HOME/Library/Android/sdk   # macOS default
```

### 3. Install on device

```bash
just install-apk   # builds + adb install in one step
```

Or manually after `just build-apk`:
```bash
adb install -r apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk
```

## Test checklist

### Auth
- [ ] Login as parent → lands on ParentNotice (web dashboard is primary)
- [x] Login as kid → lands on KidHome (or SimpleKidHome for simplified_mode) — 2026-10-21, Pixel 8
- [ ] Logout and switch roles
- [x] App reopens to the correct screen after being killed (auth persists) — force-stop + relaunch → KidHome, no login

### Kid flow
- [x] Balance displays correctly — exact vs. server after every approval (e.g. 157→168 after +3+3+5)
- [x] Chores list loads (assigned chores visible)
- [ ] Mark a chore done (non-photo)
- [x] Mark a chore done with photo (camera permission prompt appears; photo uploads) — 2026-10-21, verified via expo-file-system/legacy uploadAsync
- [x] Spend request dialog opens and submits — 2026-10-21: dialog opens, field + amount (Grits 10), Send creates pending request server-side; parent approve deducts exactly (177→167) and fires the "Spend approved" notification live
- [x] Realtime: approve a chore from the web dashboard → kid screen updates without pull-to-refresh — 2026-10-21, balance + list both live, no spinner

### Notifications (key test)
- [x] Background: lock the screen, have parent approve a chore → notification appears from **PayDirt** (not ntfy) — channel `paydirt-alerts`; all four types confirmed
- [x] Background: parent broadcasts a message → notification appears
- [ ] Foreground: app open, approve a chore → UI updates silently (no duplicate notification) — fix shipped (`ForegroundTracker`, see CHANGELOG); not yet re-verified on a device
- [ ] Alerts bell (parent + both kid UIs) lists past pushes newest-first; ✕ removes one, "Clear all" empties it
- [x] Notification tap opens the app and lands on the relevant screen — warm (2026-10-21: heads-up tap → KidHome, balance current) and cold (`am kill` → tap → cold start; process-confirmed cold start; landing screen inferred — user interaction stole the foreground mid-launch)

### Connectivity
- [x] Stop PocketBase (or disable Wi-Fi) → offline banner appears within a few seconds; last-known balance/data stays visible instead of blanking — 2026-10-21: "Can't reach home right now… Retry now" banner; balance + chore count retained
- [x] Restart PocketBase (or re-enable Wi-Fi) → banner clears and the screen reloads automatically, without a manual pull-to-refresh — banner gone ~8s after PB restart, no pull needed

### Simplified mode (youngest kid)
- [x] Giant balance card visible — 2026-10-21, child2: blue 💰 header + huge balance, verified on device
- [x] Chore cards with large "I did it!" buttons — star cards with giant gold buttons (and "Take photo!" variants for photo chores)
- [x] Broadcast cards show in blue — **stale wording**: cards use `secondaryContainer` (theme accent, olive/brown in the current kid theme), distinct from chore cards; intent satisfied

## API 34 emulator acceptance (2026-11-06)

This was an isolated, headless API 34 emulator using a disposable PocketBase
fixture. It is native-app evidence, not a physical-device or production check.

- Tablet header: wide layout placed Alerts immediately after balance, then
  Overview, Theme, Settings, and Sign out. At 711 dp, direct actions collapsed
  into the menu. Large text kept all wide actions within the header.
- Parent actions: Theme and household Settings opened; sign-out Cancel stayed
  signed in and confirm returned to login. On catalogue chores, right swipe
  opened editing with Save/Cancel above the fields; left swipe opened Archive
  confirmation. Cancel left the chore active.
- Recurring chores: standard and simplified kid layouts showed the prior
  pending occurrence and today's actionable timed occurrence with their dates.
  Both timers survived force-stop/relaunch. Approving yesterday's standard
  occurrence left today's assignment and timer unchanged.
- The Expo activity remained portrait-locked during a forced-rotation attempt;
  phone-landscape behavior was checked by rendered classification tests only.
- Existing Expo LogBox warnings appeared for notification sound `default` and
  Paper Dialog fragments. They remain tracked in [ROADMAP.md](../ROADMAP.md);
  this emulator check does not establish notification delivery behavior.

## Findings (2026-10-21 smoke test, Pixel 8 / GrapheneOS)

- **Foregrounded approve posted a duplicate notification** — fixed since (the app suppresses system notifications while foregrounded); re-verify on a device.
- **Force-stopped app drops UP messages** — after `am force-stop`, an approval's UP message never produced a notification and never retried; delivery resumed with the next message after relaunch. This is Android's stopped-state broadcast rule (no queue). Real devices only "force-stop" via user action or aggressive battery profiles — worth re-checking under GrapheneOS's default battery settings before kids rely on it.
- **Recurring "Chore time!" reminders confirmed firing** on-device in production use.
- **Realtime staleness after network interruption** — live chore-approve updates worked early in the session and again after the Wi-Fi path healed (same process, no restart). But mid-session (Wi-Fi flap / extended idle) both spend-approve and chore-approve stopped updating the kid screen live for tens of minutes, while notifications (ntfy, cloud) and manual pull-to-refresh kept working. The PocketBase realtime socket does reconnect eventually, but with a long silent gap and no UI indication. Fixed since: `useRealtimeResume` rebuilds the socket and reloads on foreground and on offline→online; re-verify on a device.
- The stray "ntfy • N" lockscreen notifications are the agent's own phone-bridge permission prompts (`[paydirt] external_directory`), not a PayDirt bug.

## Useful adb commands

```bash
adb devices                                    # list connected devices
adb install -r path/to/app-debug.apk           # install / update APK
adb logcat -s ReactNative ReactNativeJS        # stream JS console output
adb logcat | grep -i "error\|crash"            # filter for errors
adb shell am force-stop io.paydirt.app         # kill the app
adb reverse tcp:3111 tcp:3111                  # tunnel device → host (run once after plugging in)
```

## Rebuilding after code changes

```bash
just ship         # backend + release APK + in-app update + adb install; warns on uncommitted files
just push-remote  # release APK to tablets on Wi-Fi (reads deploy-devices)
just build-apk    # recompile the debug APK (no need to re-run prebuild unless app.json changed)
just install-apk  # build + install the debug APK in one step
```

`app.json` changes (new plugins, package name, icons) do not reach `android/` on their own, and `just prebuild` refuses to overwrite it (`FORCE=1` wipes the custom Kotlin; restore from git). Apply such changes to `android/` by hand or via the selective procedure in `apps/mobile/scripts/gen-icons.mjs`.

## In-app updates (no adb)

`just ship` deploys the backend, builds and publishes the release APK, mirrors it
to the host, and adb-installs on reachable devices. Uncommitted tracked or new
files produce a warning and do not block shipping. Build/deployment failures
still stop the command.

The APK versionCode remains the git commit count. Rebuilding without another
commit reuses that version, so a device already on it will not show a new
in-app update prompt; a direct adb install can reinstall it. `just release-apk`
is the APK-only part. Each tablet checks on launch, on resume, and every
15 minutes while open, then shows "Update available" for a newer version.

- Tapping Update downloads the APK and opens the Android installer when it finishes (the "download complete" notification is the fallback if the app was backgrounded). Android always requires the Install tap; reopen PayDirt afterwards and it shows "PayDirt updated".
- One-time per tablet: Settings → Apps → PayDirt → Install unknown apps → allow. Without it the install silently fails.
- If Install opens a file manager, clear that file manager's saved APK-opening
  default, retry, and choose Package installer / Always. The downloaded APK is
  in PayDirt's private cache, so it is not normally visible in Downloads.
  Material Files can install APKs, but its external APK handler can open the
  archive browser instead; that saved association caused the `.164` issue,
  resolved and confirmed on 2026-11-06.
- JS-only changes can use `just update-publish` + `just push-updates` (OTA, no prompt).
- Verified end to end on one phone 2026-10-31 (alert, download, installer, "PayDirt updated"); the other tablets need one adb install of a 2026-10-31+ build first (older builds lack the native method). `just push` stays the fallback.

## Header menu and grit dialog

- [x] Emulator 2026-11-02 (Pixel-size, parent + kid): header shows title, grit chip, (parent) overview icon and a hamburger; menu has Theme, Alerts and Sign out; unread dot on the hamburger and "Alerts (new)" until the dialog is opened; grit dialog lists grit, dollars and screen minutes per kid plus a parent total.
- [ ] Real phone and tablets: confirm the chip fits at 360 dp, the dot clears after opening Alerts, and a pushed alert lights the dot within a minute.
