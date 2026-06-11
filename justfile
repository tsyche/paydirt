# Project task runner. Run `just --list` to see all available commands.

# PocketBase binary location (downloaded separately, gitignored)
pb := "pocketbase/pocketbase"

# Default: show available commands
default:
    @just --list

# --- Setup ---

# Install all workspace dependencies (pnpm)
setup:
    @printf '\033[0;34mInstalling workspace dependencies...\033[0m\n'
    @pnpm install

# Alias for setup
install: setup

# --- Development ---

# Clear caches + start everything (PB + web + mobile); requires emulator. Pass reset=1 to wipe DB first.
dev-all reset="0":
    #!/usr/bin/env bash
    set -euo pipefail
    if [ "{{reset}}" = "1" ]; then
        printf '\033[0;34mResetting database...\033[0m\n'
        if curl -sf -o /dev/null http://127.0.0.1:8090/api/health; then
            printf '\033[0;33mPocketBase is running — stop it before resetting. Run '\''just stop'\'' first.\033[0m\n'
            exit 1
        fi
        just reset-db
    fi
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
    {{pb}} serve --dir pocketbase/pb_data --hooksDir pocketbase/pb_hooks --migrationsDir pocketbase/pb_migrations \
        > /tmp/paydirt-logs/pb.log 2>&1 & echo $! > /tmp/paydirt-pb.pid
    echo "  Waiting for PocketBase to be ready..."
    for i in $(seq 1 20); do
        if curl -sf -o /dev/null http://127.0.0.1:8090/api/health; then break; fi
        if [ "$i" = "20" ]; then
            printf '\033[0;33mPocketBase did not start in time — check /tmp/paydirt-logs/pb.log\033[0m\n'
            exit 1
        fi
        sleep 1
    done
    if [ "{{reset}}" = "1" ]; then
        printf '\033[0;34mSeeding test data...\033[0m\n'
        node pocketbase/seed.mjs
    fi
    printf '\033[0;34mStarting Next.js dashboard...\033[0m\n'
    pnpm run dev:web > /tmp/paydirt-logs/web.log 2>&1 & echo $! > /tmp/paydirt-web.pid
    sleep 3
    printf '\033[0;34mStarting Expo (mobile) → pushing to Android emulator...\033[0m\n'
    pnpm --filter mobile start -- --android > /tmp/paydirt-logs/mobile.log 2>&1 & echo $! > /tmp/paydirt-mobile.pid
    printf '\n\033[0;32mAll services running. Logs:\033[0m\n'
    echo "  PocketBase:  /tmp/paydirt-logs/pb.log"
    echo "  Dashboard:   /tmp/paydirt-logs/web.log  (http://localhost:3000)"
    echo "  Mobile/Expo: /tmp/paydirt-logs/mobile.log"
    echo "  PocketBase admin: http://localhost:8090/_/"
    echo ""
    echo "Press Ctrl+C to stop all services (or run 'just stop' from another terminal)."
    trap 'just stop' INT; wait

# Stop all PayDirt dev services
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

# Clear Next.js/.expo/Metro caches
cache-clean:
    @printf '\033[0;34mClearing build/bundler caches...\033[0m\n'
    @rm -rf apps/web/.next
    @rm -rf apps/mobile/.expo
    @rm -rf /tmp/metro-* /tmp/haste-* 2>/dev/null || true
    @rm -rf /tmp/paydirt-logs
    @printf '\033[0;32mCaches cleared.\033[0m\n'

# Start Next.js parent dashboard only
dev-web:
    @pnpm run dev:web

# Start Expo React Native app only
dev-mobile:
    @pnpm run dev:mobile

# Start PocketBase only (use NTFY_DISABLED=1 just dev-pb for test runs)
dev-pb:
    #!/usr/bin/env bash
    if [ ! -f "{{pb}}" ]; then
        printf '\033[0;33mPocketBase binary not found at {{pb}}\033[0m\n'
        echo "Run 'just pb-download' first."
        exit 1
    fi
    {{pb}} serve --dir pocketbase/pb_data --hooksDir pocketbase/pb_hooks --migrationsDir pocketbase/pb_migrations

# Download the PocketBase binary (latest, or PB_VERSION=x.y.z)
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

# --- Test data ---

# Seed test household/users/chores (PocketBase must be running)
seed:
    @printf '\033[0;34mSeeding test data (PocketBase must be running)...\033[0m\n'
    @node pocketbase/seed.mjs

# Wipe the PocketBase DB and rebuild empty (PocketBase must be stopped)
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
    printf '\033[0;32mDB reset. Now: start '\''just dev-pb'\'', then run '\''just seed'\''.\033[0m\n'

# --- Quality ---

# Run all workspace tests
test:
    @pnpm -r test

# Live API/hook tests — needs running, seeded PocketBase (use NTFY_DISABLED=1 just dev-pb)
test-integration:
    #!/usr/bin/env bash
    if ! curl -sf -o /dev/null http://127.0.0.1:8090/api/health; then
        printf '\033[0;33mPocketBase is not running. Start it ('\''just dev-pb'\'', ideally with NTFY_DISABLED=1) and '\''just seed'\'' first.\033[0m\n'
        exit 1
    fi
    pnpm --filter @paydirt/shared test:integration

# Playwright dashboard tests — needs running, seeded PocketBase
test-e2e:
    #!/usr/bin/env bash
    if ! curl -sf -o /dev/null http://127.0.0.1:8090/api/health; then
        printf '\033[0;33mPocketBase is not running. Start it ('\''just dev-pb'\'', ideally with NTFY_DISABLED=1) and '\''just seed'\'' first.\033[0m\n'
        exit 1
    fi
    pnpm --filter web test:e2e

# Self-contained test run: ephemeral PB on :8091, migrate, seed, integration + e2e, teardown
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

    if lsof -ti :3000 &>/dev/null; then
        printf '\033[0;33mNote: port 3000 already in use — Playwright will reuse that server.\033[0m\n'
        printf '\033[0;33m      If it is a dev server pointed at 8090, e2e results may be unreliable.\033[0m\n'
    fi
    printf '\033[0;34mRunning e2e tests...\033[0m\n'
    PB_URL="${TEST_URL}" NEXT_PUBLIC_POCKETBASE_URL="${TEST_URL}" pnpm --filter web test:e2e

    printf '\033[0;32mAll tests passed.\033[0m\n'

# Type-check all workspaces (tsc --noEmit)
typecheck:
    @printf '\033[0;34mType-checking all workspaces...\033[0m\n'
    @pnpm -r typecheck

# Lint all workspaces
lint:
    @pnpm -r lint

# Auto-fix lint issues
lintfix:
    @pnpm -r lint:fix

# --- Maintenance ---

# Remove build artifacts, caches, node_modules
clean: cache-clean
    @printf '\033[0;34mRemoving node_modules and build outputs...\033[0m\n'
    @rm -rf node_modules apps/*/node_modules packages/*/node_modules
    @rm -rf apps/web/out apps/*/dist packages/*/dist
    @find . -name "*.tsbuildinfo" -delete 2>/dev/null || true

# Build all apps for production (mobile production build requires EAS: eas build)
build:
    @printf '\033[0;34mBuilding web app...\033[0m\n'
    @pnpm --filter web build

# Full reset: clean + setup + test
fresh: clean setup test

# Sync AGENTS.md ↔ CLAUDE.md
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
