# Project task runner. Run `just --list` to see all available commands.

# PocketBase binary location (downloaded separately, gitignored)
pb := "pocketbase/pocketbase"
pb-serve-args := "serve --dir pocketbase/pb_data --hooksDir pocketbase/pb_hooks --migrationsDir pocketbase/pb_migrations --http 0.0.0.0:8090"

# Default: show the "what do I want to do" cheat sheet
default:
    #!/usr/bin/env bash
    printf '\n\033[1mPayDirt — pick your scenario:\033[0m\n'
    printf '\n\033[1mFirst time on this machine\033[0m\n'
    printf '  just setup          install dependencies\n'
    printf '  just pb-download    download the PocketBase binary\n'
    printf '  just fresh          reset DB, seed data, start everything (needs an Android emulator running)\n'
    printf '\n\033[1mDevelop with Expo + an Android emulator (day to day)\033[0m\n'
    printf '  just fresh          reset DB + start PocketBase, web, and Expo together\n'
    printf '  just stop           stop everything '\''fresh'\'' started\n'
    printf '\n\033[1mTest on a real phone — live Expo dev mode (JS hot reload, scan a QR code)\033[0m\n'
    printf '  just dev-device     start PocketBase (LAN-bound) + Expo for a physical device\n'
    printf '\n\033[1mTest on a real phone — APK already installed, just need the backend + web UI\033[0m\n'
    printf '  just dev-backend    start PocketBase (LAN-bound) + the web dashboard\n'
    printf '  just install-apk    build + install a debug APK on a connected device/emulator\n'
    printf '\n\033[1mShip a release build to family devices\033[0m\n'
    printf '  just deploy-start          step-by-step pairing + install instructions\n'
    printf '  just install-apk-release-all   build a signed release APK, install on every connected device\n'
    printf '\n\033[1mIndividual services\033[0m (if you do not want a combined recipe above)\n'
    printf '  just dev-pb   just dev-web   just dev-mobile\n'
    printf '\n\033[1mEverything else\033[0m (tests, lint, db reset, cleanup, ...)\n'
    printf '  just --list\n\n'

# --- Quick Start ---

# Install workspace dependencies (one-time, or after pulling new deps)
[group('development')]
setup:
    @pnpm install

# Print release APK deployment steps for real devices
deploy-start:
    @printf '\n\033[1mDeploy release APK to real devices:\033[0m\n'
    @printf '  1. On each device: Settings → Developer Options → Wireless Debugging → enable\n'
    @printf '     then tap "Pair device with pairing code" and run:\n'
    @printf '       adb pair <ip>:<pair-port>    (enter pairing code)\n'
    @printf '       adb connect <ip>:<port>       (the main debug port shown on device)\n'
    @printf '  2. Verify: adb devices             (should list each device)\n'
    @printf '  3. Install: just install-apk-release-all\n'
    @printf '     (builds a signed release APK and pushes to every connected device)\n\n'

# --- Development ---

# Reset DB + seed + start everything. Pass nuke=1 to also wipe node_modules and reinstall deps first.
[group('development')]
fresh nuke="0":
    #!/usr/bin/env bash
    set -euo pipefail
    CLEAR_FLAG=""
    if [ "{{nuke}}" = "1" ]; then
        printf '\033[0;34mNuking caches and node_modules...\033[0m\n'
        just clean
        printf '\033[0;34mReinstalling dependencies...\033[0m\n'
        pnpm install
        CLEAR_FLAG="--clear"   # force Metro to rebuild its transform cache on a nuke
    fi
    printf '\033[0;34mResetting database...\033[0m\n'
    if curl -sf -o /dev/null http://127.0.0.1:8090/api/health; then
        printf '\033[0;33mPocketBase is running — stop it first (just stop).\033[0m\n'
        exit 1
    fi
    just reset-db
    if ! adb devices 2>/dev/null | grep -q "emulator.*device"; then
        printf '\033[0;33mNo Android emulator detected. Start one first (AVD Manager or '\''emulator -avd Pixel_7_API_33 &'\'').\033[0m\n'
        exit 1
    fi
    if [ ! -f "{{pb}}" ]; then
        printf '\033[0;33mPocketBase binary not found — run '\''just pb-download'\''.\033[0m\n'
        exit 1
    fi
    mkdir -p /tmp/paydirt-logs
    printf '\033[0;34mStarting PocketBase...\033[0m\n'
    {{pb}} {{pb-serve-args}} > /tmp/paydirt-logs/pb.log 2>&1 & echo $! > /tmp/paydirt-pb.pid
    echo "  Waiting for PocketBase to be ready..."
    for i in $(seq 1 20); do
        if curl -sf -o /dev/null http://127.0.0.1:8090/api/health; then break; fi
        if [ "$i" = "20" ]; then
            printf '\033[0;33mPocketBase did not start in time — check /tmp/paydirt-logs/pb.log\033[0m\n'
            exit 1
        fi
        sleep 1
    done
    printf '\033[0;34mSeeding test data...\033[0m\n'
    node pocketbase/seed.mjs
    printf '\033[0;34mStarting Next.js dashboard...\033[0m\n'
    pnpm run dev:web > /tmp/paydirt-logs/web.log 2>&1 & echo $! > /tmp/paydirt-web.pid
    sleep 3
    printf '\033[0;34mStarting Metro bundler...\033[0m\n'
    # Start Metro only — do NOT pass --android (that opens Expo Go, which can't
    # run this app's native modules: expo-notifications remote push, background
    # actions, UnifiedPush). We launch the installed dev build instead.
    pnpm --filter mobile start -- $CLEAR_FLAG > /tmp/paydirt-logs/mobile.log 2>&1 & echo $! > /tmp/paydirt-mobile.pid
    sleep 4
    if adb shell pm list packages 2>/dev/null | grep -q "io.paydirt.app"; then
        printf '\033[0;34mLaunching PayDirt dev build on the emulator...\033[0m\n'
        adb shell monkey -p io.paydirt.app -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1 || true
    else
        printf '\033[0;33mDev build (io.paydirt.app) not installed — run "just install-apk", then open PayDirt on the emulator. (Expo Go will NOT work for this app.)\033[0m\n'
    fi
    printf '\n\033[0;32mAll services running. Logs:\033[0m\n'
    echo "  PocketBase:  /tmp/paydirt-logs/pb.log"
    echo "  Dashboard:   /tmp/paydirt-logs/web.log  (http://localhost:3000)"
    echo "  Mobile/Expo: /tmp/paydirt-logs/mobile.log"
    echo "  PocketBase admin: http://localhost:8090/_/"
    echo ""
    echo "Press Ctrl+C to stop all services (or run 'just stop' from another terminal)."
    trap 'just stop' INT; wait

# Install release build on all real devices + start backend + web (one command)
[group('development')]
release-all:
    #!/usr/bin/env bash
    set -euo pipefail
    printf '\033[0;34mBuilding and installing release APK on all devices...\033[0m\n'
    just install-apk-release-all
    printf '\n\033[0;34mStarting PocketBase...\033[0m\n'
    mkdir -p /tmp/paydirt-logs
    NTFY_DISABLED=1 {{pb}} {{pb-serve-args}} > /tmp/paydirt-logs/pb.log 2>&1 & echo $! > /tmp/paydirt-pb.pid
    sleep 3
    printf '\033[0;34mSeeding test data...\033[0m\n'
    node pocketbase/seed.mjs
    printf '\033[0;34mStarting web dashboard...\033[0m\n'
    pnpm run dev:web > /tmp/paydirt-logs/web.log 2>&1 & echo $! > /tmp/paydirt-web.pid
    printf '\n\033[0;32m✓ All set!\033[0m\n'
    echo ""
    echo "  Mobile app: Open PayDirt on your real device"
    echo "  Parent UI:  http://localhost:3000 (parent@test.local / password123)"
    echo "  Admin UI:   http://localhost:8090/_ (admin@paydirt.local / password123)"
    echo ""
    echo "All services running in background. Logs:"
    echo "  PocketBase: /tmp/paydirt-logs/pb.log"
    echo "  Dashboard:  /tmp/paydirt-logs/web.log"
    echo ""
    echo "Stop with: just stop"

# Stop all PayDirt dev services
[group('development')]
stop:
    #!/usr/bin/env bash
    printf '\033[0;34mStopping PayDirt services...\033[0m\n'
    for pid_file in /tmp/paydirt-pb.pid /tmp/paydirt-web.pid /tmp/paydirt-mobile.pid; do
        if [ -f "$pid_file" ]; then
            pid=$(cat "$pid_file")
            if kill -0 "$pid" 2>/dev/null; then kill "$pid"; fi
            rm -f "$pid_file"
        fi
    done
    pkill -f "pocketbase serve" 2>/dev/null || true
    pkill -f "next dev" 2>/dev/null || true
    pkill -f "expo start" 2>/dev/null || true
    if adb devices 2>/dev/null | grep -q "emulator.*device"; then
        adb shell am force-stop host.exp.exponent 2>/dev/null || true
    fi
    printf '\033[0;32mDone.\033[0m\n'

# Start PocketBase only (use NTFY_DISABLED=1 just dev-pb for test runs)
[group('development')]
dev-pb:
    #!/usr/bin/env bash
    if [ ! -f "{{pb}}" ]; then
        printf '\033[0;33mPocketBase binary not found at {{pb}}\033[0m\n'
        echo "Run 'just pb-download' first."
        exit 1
    fi
    {{pb}} {{pb-serve-args}}

# Start Next.js parent dashboard only
[group('development')]
dev-web:
    @pnpm run dev:web

# Start Expo React Native app only
[group('development')]
dev-mobile:
    @pnpm run dev:mobile

# Start PB + Expo pointed at a physical Android device over LAN
[group('development')]
dev-device:
    #!/usr/bin/env bash
    set -euo pipefail
    LAN_IP=$(ipconfig getifaddr en0 2>/dev/null || ip route get 1 2>/dev/null | awk '{print $7; exit}' || echo "")
    if [ -z "${LAN_IP}" ]; then
        printf '\033[0;33mCould not detect LAN IP. Set EXPO_PUBLIC_POCKETBASE_URL manually.\033[0m\n'
        exit 1
    fi
    if [ ! -f "{{pb}}" ]; then
        printf '\033[0;33mPocketBase binary not found — run '\''just pb-download'\''.\033[0m\n'
        exit 1
    fi
    printf '\033[0;32mLAN IP: %s\033[0m\n' "${LAN_IP}"
    printf '\033[0;34mStarting PocketBase (listening on all interfaces)...\033[0m\n'
    mkdir -p /tmp/paydirt-logs
    {{pb}} {{pb-serve-args}} > /tmp/paydirt-logs/pb.log 2>&1 & echo $! > /tmp/paydirt-pb.pid
    sleep 2
    printf '\033[0;34mStarting Expo (scan QR on device)...\033[0m\n'
    printf '\n  Device PB URL: http://%s:8090\n' "${LAN_IP}"
    printf '  Set in .env:   EXPO_PUBLIC_POCKETBASE_URL=http://%s:8090\n\n' "${LAN_IP}"
    EXPO_PUBLIC_POCKETBASE_URL="http://${LAN_IP}:8090" pnpm --filter mobile start

# Start PocketBase (LAN-bound) + web dashboard only — for a real device with the APK already installed
[group('development')]
dev-backend:
    #!/usr/bin/env bash
    set -euo pipefail
    LAN_IP=$(ipconfig getifaddr en0 2>/dev/null || ip route get 1 2>/dev/null | awk '{print $7; exit}' || echo "")
    if [ ! -f "{{pb}}" ]; then
        printf '\033[0;33mPocketBase binary not found — run '\''just pb-download'\''.\033[0m\n'
        exit 1
    fi
    mkdir -p /tmp/paydirt-logs
    printf '\033[0;34mStarting PocketBase (listening on all interfaces)...\033[0m\n'
    {{pb}} {{pb-serve-args}} > /tmp/paydirt-logs/pb.log 2>&1 & echo $! > /tmp/paydirt-pb.pid
    sleep 1
    printf '\033[0;34mStarting Next.js dashboard...\033[0m\n'
    pnpm run dev:web > /tmp/paydirt-logs/web.log 2>&1 & echo $! > /tmp/paydirt-web.pid
    printf '\n\033[0;32mRunning:\033[0m\n'
    if [ -n "${LAN_IP}" ]; then
        printf '  Device PB URL:    http://%s:8090  (must match EXPO_PUBLIC_POCKETBASE_URL baked into the APK)\n' "${LAN_IP}"
    fi
    printf '  PocketBase admin: http://localhost:8090/_/\n'
    printf '  Web dashboard:    http://localhost:3000\n'
    printf '\nPress Ctrl+C to stop (or run '\''just stop'\'' from another terminal).\n\n'
    trap 'just stop' INT; wait

# Tunnel device USB traffic → host port 8090 (run once after plugging in; lets device use 127.0.0.1)
[group('development')]
adb-tunnel:
    @adb reverse tcp:8090 tcp:8090
    @printf '\033[0;32mTunnel set: device:8090 → host:8090. Use EXPO_PUBLIC_POCKETBASE_URL=http://127.0.0.1:8090\033[0m\n'

# Download the PocketBase binary (latest, or PB_VERSION=x.y.z)
[group('development')]
pb-download:
    #!/usr/bin/env bash
    os=$(uname -s | tr '[:upper:]' '[:lower:]')
    arch=$(uname -m | sed 's/x86_64/amd64/; s/aarch64/arm64/')
    ver="${PB_VERSION:-}"
    if [ -z "$ver" ]; then
        ver=$(curl -sL https://api.github.com/repos/pocketbase/pocketbase/releases/latest | jq -r '.tag_name' | sed 's/^v//')
    fi
    if [ -z "$ver" ] || [ "$ver" = "null" ]; then
        printf '\033[0;33mCould not resolve PocketBase version. Set PB_VERSION=x.y.z manually.\033[0m\n'
        exit 1
    fi
    url="https://github.com/pocketbase/pocketbase/releases/download/v${ver}/pocketbase_${ver}_${os}_${arch}.zip"
    printf '\033[0;34mDownloading PocketBase %s (%s/%s)...\033[0m\n' "$ver" "$os" "$arch"
    curl -sL "$url" -o /tmp/pocketbase.zip && \
    unzip -o /tmp/pocketbase.zip pocketbase -d pocketbase/ && \
    chmod +x {{pb}} && rm -f /tmp/pocketbase.zip
    printf '\033[0;32mInstalled %s\033[0m\n' "$({{pb}} --version)"

# --- Android ---

# Generate native android/ directory from app.json (run once, or after app.json changes)
[group('android')]
prebuild:
    #!/usr/bin/env bash
    set -euo pipefail
    if [ ! -f apps/mobile/.env ] && [ -z "${EXPO_PUBLIC_POCKETBASE_URL:-}" ]; then
        printf '\033[0;33mSet EXPO_PUBLIC_POCKETBASE_URL before prebuilding.\033[0m\n'
        printf '\033[0;33mExample: echo "EXPO_PUBLIC_POCKETBASE_URL=http://192.168.1.50:8090" > apps/mobile/.env\033[0m\n'
        exit 1
    fi
    printf '\033[0;34mInstalling mobile dependencies...\033[0m\n'
    pnpm --filter mobile install
    printf '\033[0;34mGenerating native Android project...\033[0m\n'
    cd apps/mobile && npx expo prebuild --platform android --no-install
    printf '\033[0;32mDone. Run '\''just build-apk-release'\'' to produce the APK.\033[0m\n'

# Build a release APK — signed, minified, upgrades in-place on device (bump versionCode before each release)
[group('android')]
build-apk-release:
    #!/usr/bin/env bash
    set -euo pipefail
    if [ ! -d "apps/mobile/android" ]; then
        printf '\033[0;33mandroid/ not found — run '\''just prebuild'\'' first.\033[0m\n'
        exit 1
    fi
    printf '\033[0;34mBuilding release APK...\033[0m\n'
    cd apps/mobile/android && ./gradlew assembleRelease
    APK="apps/mobile/android/app/build/outputs/apk/release/app-release.apk"
    printf '\033[0;32mAPK ready: %s\033[0m\n' "${APK}"
    printf 'Install on every connected device: just install-apk-release-all\n'

# Build release APK + install on every adb-connected device (USB or wireless adb connect)
[group('android')]
install-apk-release-all: build-apk-release
    #!/usr/bin/env bash
    set -euo pipefail
    APK="apps/mobile/android/app/build/outputs/apk/release/app-release.apk"
    # Extract device serials: match lines ending with "device", remove "device" and
    # trailing whitespace, filter out emulator. Use while-read to preserve spaces in serials.
    adb devices | grep -E 'device$' | grep -v emulator | sed 's/[[:space:]]*device$//' | while read d; do
        if [ -n "$d" ]; then
            printf '\033[0;34mInstalling on %s...\033[0m\n' "$d"
            adb -s "$d" install -r "$APK"
        fi
    done
    printf '\033[0;32mDone.\033[0m\n'

# Build a debug APK (faster, no signing — for emulator/dev use only)
[group('android')]
build-apk:
    #!/usr/bin/env bash
    set -euo pipefail
    if [ ! -d "apps/mobile/android" ]; then
        printf '\033[0;33mandroid/ not found — run '\''just prebuild'\'' first.\033[0m\n'
        exit 1
    fi
    printf '\033[0;34mBuilding debug APK...\033[0m\n'
    cd apps/mobile/android && ./gradlew assembleDebug
    APK="apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk"
    printf '\033[0;32mAPK ready: %s\033[0m\n' "${APK}"
    printf 'Install with: adb install -r %s\n' "${APK}"

# Build debug APK + install on the connected emulator/device
[group('android')]
install-apk: build-apk
    @adb install -r apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk
    @printf '\033[0;32mInstalled.\033[0m\n'

# --- Test data ---

# Seed test household/users/chores (PocketBase must be running)
[group('test data')]
seed:
    @printf '\033[0;34mSeeding test data (PocketBase must be running)...\033[0m\n'
    @node pocketbase/seed.mjs

# Wipe the PocketBase DB and rebuild empty (PocketBase must be stopped)
[group('test data')]
reset-db:
    #!/usr/bin/env bash
    if [ ! -f "{{pb}}" ]; then
        printf '\033[0;33mPocketBase binary not found — run '\''just pb-download'\''.\033[0m\n'
        exit 1
    fi
    if curl -sf -o /dev/null http://127.0.0.1:8090/api/health; then
        printf '\033[0;33mPocketBase is running. Stop '\''just dev-pb'\'' first, then re-run '\''just reset-db'\''.\033[0m\n'
        exit 1
    fi
    printf '\033[0;34mWiping PocketBase data and rebuilding empty DB...\033[0m\n'
    rm -rf pocketbase/pb_data
    {{pb}} migrate up --dir pocketbase/pb_data --migrationsDir pocketbase/pb_migrations
    {{pb}} superuser upsert admin@paydirt.local password123 --dir pocketbase/pb_data
    printf '\033[0;32mDB reset. Run '\''just fresh'\'' to seed and start, or '\''just seed'\'' after starting dev-pb manually.\033[0m\n'

# --- Quality ---

# Run all workspace tests
[group('quality')]
test:
    @pnpm -r test

# Live API/hook tests — needs running, seeded PocketBase (use NTFY_DISABLED=1 just dev-pb)
[group('quality')]
test-integration:
    #!/usr/bin/env bash
    if ! curl -sf -o /dev/null http://127.0.0.1:8090/api/health; then
        printf '\033[0;33mPocketBase is not running. Start it ('\''just dev-pb'\'', ideally with NTFY_DISABLED=1) and '\''just seed'\'' first.\033[0m\n'
        exit 1
    fi
    pnpm --filter @paydirt/shared test:integration

# Playwright dashboard tests — needs running, seeded PocketBase
[group('quality')]
test-e2e:
    #!/usr/bin/env bash
    if ! curl -sf -o /dev/null http://127.0.0.1:8090/api/health; then
        printf '\033[0;33mPocketBase is not running. Start it ('\''just dev-pb'\'', ideally with NTFY_DISABLED=1) and '\''just seed'\'' first.\033[0m\n'
        exit 1
    fi
    pnpm --filter web test:e2e

# Self-contained test run: ephemeral PB on :8091, migrate, seed, integration + e2e, teardown
[group('quality')]
test-all:
    #!/usr/bin/env bash
    set -euo pipefail
    TEST_PORT=8091
    TEST_URL="http://127.0.0.1:${TEST_PORT}"
    EDIR=$(mktemp -d)

    cleanup() {
        if [ -f "${EDIR}/pb.pid" ]; then
            kill "$(cat "${EDIR}/pb.pid")" 2>/dev/null || true
        fi
        rm -rf "${EDIR}"
        printf '\033[0;34mEphemeral PB torn down.\033[0m\n'
    }
    trap cleanup EXIT INT TERM

    if [ ! -f "{{pb}}" ]; then
        printf '\033[0;33mPocketBase binary not found — run '\''just pb-download'\''.\033[0m\n'
        exit 1
    fi
    if lsof -ti :"${TEST_PORT}" &>/dev/null; then
        printf '\033[0;33mPort %s is already in use. Stop that process first.\033[0m\n' "${TEST_PORT}"
        exit 1
    fi

    printf '\033[0;34mBootstrapping ephemeral PocketBase on :%s...\033[0m\n' "${TEST_PORT}"
    {{pb}} migrate up --dir "${EDIR}/pb_data" --migrationsDir pocketbase/pb_migrations 2>&1 | grep -v '^$' || true
    {{pb}} superuser upsert admin@paydirt.local password123 --dir "${EDIR}/pb_data" 2>&1 | grep -v '^$' || true

    NTFY_DISABLED=1 {{pb}} serve \
        --dir "${EDIR}/pb_data" \
        --hooksDir pocketbase/pb_hooks \
        --migrationsDir pocketbase/pb_migrations \
        --http "127.0.0.1:${TEST_PORT}" \
        > "${EDIR}/pb.log" 2>&1 &
    echo $! > "${EDIR}/pb.pid"

    printf 'Waiting for PocketBase...'
    for i in $(seq 1 30); do
        if curl -sf -o /dev/null "${TEST_URL}/api/health"; then printf ' ready.\n'; break; fi
        [ "${i}" = "30" ] && { printf '\nFailed to start — see %s\n' "${EDIR}/pb.log"; cat "${EDIR}/pb.log"; exit 1; }
        sleep 1
    done

    printf '\033[0;34mSeeding...\033[0m\n'
    PB_URL="${TEST_URL}" node pocketbase/seed.mjs

    printf '\033[0;34mRunning integration tests...\033[0m\n'
    PB_URL="${TEST_URL}" pnpm --filter @paydirt/shared test:integration

    printf '\033[0;34mVerifying ledger integrity...\033[0m\n'
    PB_URL="${TEST_URL}" node pocketbase/verify-ledger.mjs

    if lsof -ti :3000 &>/dev/null; then
        printf '\033[0;33mNote: port 3000 already in use — Playwright will reuse that server.\033[0m\n'
        printf '\033[0;33m      If it is a dev server pointed at 8090, e2e results may be unreliable.\033[0m\n'
    fi
    printf '\033[0;34mRunning e2e tests...\033[0m\n'
    PB_URL="${TEST_URL}" NEXT_PUBLIC_POCKETBASE_URL="${TEST_URL}" pnpm --filter web test:e2e

    printf '\033[0;32mAll tests passed.\033[0m\n'

# Recompute every user's balance from currency_transactions and diff against the
# cached value — needs running, seeded PocketBase (use NTFY_DISABLED=1 just dev-pb)
[group('quality')]
verify-ledger:
    #!/usr/bin/env bash
    if ! curl -sf -o /dev/null http://127.0.0.1:8090/api/health; then
        printf '\033[0;33mPocketBase is not running. Start it ('\''just dev-pb'\'') first.\033[0m\n'
        exit 1
    fi
    node pocketbase/verify-ledger.mjs

# Type-check all workspaces (tsc --noEmit)
[group('quality')]
typecheck:
    @printf '\033[0;34mType-checking all workspaces...\033[0m\n'
    @pnpm -r typecheck

# Lint all workspaces
[group('quality')]
lint:
    @pnpm -r lint

# Auto-fix lint issues
[group('quality')]
lintfix:
    @pnpm -r lint:fix

# --- Maintenance ---

# Remove build artifacts, caches, node_modules
[group('maintenance')]
clean: cache-clean
    @printf '\033[0;34mRemoving node_modules and build outputs...\033[0m\n'
    @rm -rf node_modules apps/*/node_modules packages/*/node_modules
    @rm -rf apps/web/out apps/*/dist packages/*/dist
    @find . -name "*.tsbuildinfo" -delete 2>/dev/null || true

# Clear Next.js/.expo/Metro caches
[group('maintenance')]
cache-clean:
    @printf '\033[0;34mClearing build/bundler caches...\033[0m\n'
    @rm -rf apps/web/.next
    @rm -rf apps/mobile/.expo
    # Metro caches live in $TMPDIR on macOS (/var/folders/.../T), /tmp on Linux — clear both.
    @rm -rf "${TMPDIR:-/tmp}"/metro-* "${TMPDIR:-/tmp}"/haste-* /tmp/metro-* /tmp/haste-* 2>/dev/null || true
    @rm -rf /tmp/paydirt-logs
    @printf '\033[0;32mCaches cleared.\033[0m\n'

# Build web app for production (mobile production build requires EAS: eas build)
[group('maintenance')]
build:
    @printf '\033[0;34mBuilding web app...\033[0m\n'
    @pnpm --filter web build

# Sync AGENTS.md ↔ CLAUDE.md
[group('maintenance')]
sync-docs:
    #!/usr/bin/env bash
    if [ -f AGENTS.md ] && [ -f CLAUDE.md ]; then
        if [ AGENTS.md -nt CLAUDE.md ]; then
            cp AGENTS.md CLAUDE.md
            printf '\033[0;32mSynced AGENTS.md -> CLAUDE.md\033[0m\n'
        elif [ CLAUDE.md -nt AGENTS.md ]; then
            cp CLAUDE.md AGENTS.md
            printf '\033[0;32mSynced CLAUDE.md -> AGENTS.md\033[0m\n'
        else
            printf '\033[0;34mBoth docs in sync\033[0m\n'
        fi
    else
        printf '\033[0;33mAGENTS.md and/or CLAUDE.md missing — nothing to sync\033[0m\n'
    fi
