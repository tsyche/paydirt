# Physical Device Testing

Guide for testing on a real Android device (GrapheneOS / LineageOS).

## Prerequisites

**On the device:**
1. Enable Developer Options: Settings → About → tap Build Number 7 times
2. Enable USB Debugging: Settings → System → Developer Options → USB Debugging
3. Install Expo Go — not available on Play Store; sideload the APK from [expo.dev/go](https://expo.dev/go)
   - GrapheneOS: enable "Install unknown apps" for your browser, download, install, then re-disable
4. Connect device via USB and trust the computer when prompted

**On your machine:**
```bash
adb devices   # should show the device as "device" (not "unauthorized")
```

If it shows `unauthorized`, revoke USB debugging auth on the device and reconnect.

## Running

```bash
just dev-device
```

This:
- Detects your LAN IP
- Starts PocketBase listening on `0.0.0.0:8090` (accessible to the device)
- Starts Expo and prints the QR code and LAN URL

Open Expo Go on the device, scan the QR code.

If you already have a `.env` file, set the device URL there so you don't need to pass it every time:
```
EXPO_PUBLIC_POCKETBASE_URL=http://192.168.1.50:8090   # your actual LAN IP
```

## Test checklist

### Auth
- [ ] Login as parent → lands on parent dashboard
- [ ] Login as kid → lands on KidHome (or SimpleKidHome for simplified_mode user)
- [ ] Logout and switch roles

### Kid flow
- [ ] Balance displays correctly
- [ ] Chores list loads (assigned chores visible)
- [ ] Mark a chore done (non-photo)
- [ ] Mark a chore done with photo (`expo-image-picker` camera permission prompt appears; photo uploads)
- [ ] Spend request dialog opens and submits
- [ ] Realtime: approve a chore from the web dashboard → kid screen updates without pull-to-refresh
- [ ] Broadcast from parent → appears in "From parent 📣" section

### Simplified mode (youngest kid)
- [ ] Giant balance card visible
- [ ] Chore cards with large "I did it!" buttons
- [ ] Broadcast cards show in blue

### ntfy
- [ ] ntfy notification received on device when chore is assigned (requires device subscribed to the kid's ntfy topic)
  - Install ntfy app from F-Droid (Play-Services-free)
  - Subscribe to the kid's topic

### Known GrapheneOS / LineageOS notes
- No FCM — this app uses ntfy over plain HTTP/SSE, so no Google dependency at all
- Camera permission may show a different permission dialog; accept it
- `react-native-sse` provides the SSE polyfill so realtime works without any Google services

## Useful adb commands

```bash
adb devices                          # list connected devices
adb logcat -s ReactNative ReactNativeJS   # stream JS console output
adb logcat | grep -i "error\|crash"  # filter for errors
adb shell am force-stop host.exp.exponent  # kill Expo Go
adb reverse tcp:8090 tcp:8090        # tunnel device → host (alternative to LAN IP)
```

`adb reverse` is worth knowing: it tunnels device traffic back to your machine, so you can keep `EXPO_PUBLIC_POCKETBASE_URL=http://127.0.0.1:8090` and skip the LAN IP entirely. Run it once after plugging in.
