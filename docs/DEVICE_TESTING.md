# Physical Device Testing

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

## Build the APK

### 1. Set the server URL

Create `apps/mobile/.env` with your PocketBase server address:

```bash
# LAN IP (find with: ipconfig getifaddr en0 on macOS Wi-Fi)
echo "EXPO_PUBLIC_POCKETBASE_URL=http://192.168.1.50:8090" > apps/mobile/.env

# Or use adb reverse (USB tunnel) and keep 127.0.0.1:
just adb-tunnel
echo "EXPO_PUBLIC_POCKETBASE_URL=http://127.0.0.1:8090" > apps/mobile/.env
```

### 2. Generate native project + build APK

```bash
just prebuild    # generates apps/mobile/android/ from app.json (run once)
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
- [ ] Login as kid → lands on KidHome (or SimpleKidHome for simplified_mode)
- [ ] Logout and switch roles
- [ ] App reopens to the correct screen after being killed (auth persists)

### Kid flow
- [ ] Balance displays correctly
- [ ] Chores list loads (assigned chores visible)
- [ ] Mark a chore done (non-photo)
- [ ] Mark a chore done with photo (camera permission prompt appears; photo uploads)
- [ ] Spend request dialog opens and submits
- [ ] Realtime: approve a chore from the web dashboard → kid screen updates without pull-to-refresh

### Notifications (key test)
- [ ] Background: lock the screen, have parent approve a chore → notification appears from **PayDirt** (not ntfy)
- [ ] Background: parent broadcasts a message → notification appears
- [ ] Foreground: app open, approve a chore → UI updates silently (no duplicate notification)
- [ ] Notification tap opens the app

### Simplified mode (youngest kid)
- [ ] Giant balance card visible
- [ ] Chore cards with large "I did it!" buttons
- [ ] Broadcast cards show in blue

## Useful adb commands

```bash
adb devices                                    # list connected devices
adb install -r path/to/app-debug.apk           # install / update APK
adb logcat -s ReactNative ReactNativeJS        # stream JS console output
adb logcat | grep -i "error\|crash"            # filter for errors
adb shell am force-stop io.paydirt.app         # kill the app
adb reverse tcp:8090 tcp:8090                  # tunnel device → host (run once after plugging in)
```

## Rebuilding after code changes

```bash
just build-apk    # recompile (no need to re-run prebuild unless app.json changed)
just install-apk  # build + install in one step
```

Re-run `just prebuild` only when `app.json` changes (new plugins, package name, etc.).
