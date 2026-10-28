#!/usr/bin/env bash
# Family Link grants on the deploy host (see docs/DEPLOYMENT.md#family-link-grants).
#   fl-host.sh setup [browsers]        install Node 24 + Playwright browsers (default: firefox),
#                                      ship the grant script, copy the Mac session + API key.
#                                      Re-run after `just fl-login` to recopy the session.
#   fl-host.sh grant <seconds> [browser]  test grant as the paydirt user in its own systemd-run
#                                      scope, using FL_CHILD_ID/FL_DEVICE_ID from familylink.env.
# Secrets (session, API key) travel over ssh/rsync only; never on a command line.
set -euo pipefail

repo_dir=$(cd "$(dirname "$0")/.." && pwd)
source "$repo_dir/scripts/deploy-host.sh"
remote=$(read_deploy_host "$repo_dir")
fl_dir="$HOME/.config/paydirt"
env_file="$fl_dir/familylink.env"
action=${1:-}

if [[ ! -t 0 ]]; then
    echo "Run this from a terminal so remote sudo can prompt for your password." >&2
    exit 1
fi
[[ -f $env_file ]] || { echo "Missing $env_file (FL_CHILD_ID, FL_DEVICE_ID, FL_API_KEY)." >&2; exit 1; }

setup() {
    local browsers=${1:-firefox} state="$fl_dir/familylink-state.json" pw_version
    for b in $browsers; do
        [[ $b == firefox || $b == chromium ]] || { echo "unsupported browser: $b" >&2; exit 2; }
    done
    [[ -f $state ]] || { echo "Missing $state; run just fl-login first." >&2; exit 1; }
    grep -q '^FL_API_KEY=.' "$env_file" || { echo "FL_API_KEY is not set in $env_file." >&2; exit 1; }
    pw_version=$(node -p 'require("playwright/package.json").version')

    stage=$(ssh "$remote" 'mktemp -d /tmp/paydirt-fl.XXXXXX')
    cleanup() { ssh "$remote" "rm -rf -- '$stage'" >/dev/null 2>&1 || true; }
    trap cleanup EXIT

    rsync -t "$repo_dir/scripts/familylink-grant.mjs" "$repo_dir/packages/shared/src/familylink.ts" \
        "$repo_dir/scripts/fl-host-apply.sh" "$remote:$stage/"
    ssh "$remote" "umask 077; cat > '$stage/familylink-state.json'" <"$state"
    grep '^FL_API_KEY=' "$env_file" | ssh "$remote" "umask 077; cat > '$stage/fl.env'"

    ssh -tt "$remote" "bash '$stage/fl-host-apply.sh' '$stage' '$pw_version' '$browsers'"
}

grant() {
    local seconds=${1:-} browser=${2:-firefox}
    [[ $seconds =~ ^[0-9]{1,5}$ ]] || { echo "usage: fl-host.sh grant <seconds> [firefox|chromium]" >&2; exit 2; }
    [[ $browser == firefox || $browser == chromium ]] || { echo "unsupported browser: $browser" >&2; exit 2; }
    local child device
    child=$(sed -n 's/^FL_CHILD_ID=//p' "$env_file")
    device=$(sed -n 's/^FL_DEVICE_ID=//p' "$env_file")
    [[ $child =~ ^[0-9]+$ && $device =~ ^[a-z0-9]+$ ]] || { echo "FL_CHILD_ID/FL_DEVICE_ID missing or malformed in $env_file." >&2; exit 1; }

    local fl=/var/lib/paydirt/familylink opt=/opt/paydirt/familylink
    set +e
    ssh -tt "$remote" "sudo systemd-run --quiet --wait --pipe --collect \
        --uid=paydirt --gid=paydirt \
        -p EnvironmentFile=/etc/paydirt/paydirt.env \
        -p MemoryMax=1G -p CPUQuota=100% \
        -p NoNewPrivileges=yes -p PrivateTmp=yes -p ProtectSystem=strict -p ProtectHome=yes \
        -p ReadWritePaths=$fl \
        -E HOME=/tmp -E FL_STATE=$fl/familylink-state.json -E FL_BROWSER=$browser \
        -E PLAYWRIGHT_BROWSERS_PATH=$opt/browsers \
        /usr/bin/node --experimental-strip-types $opt/scripts/familylink-grant.mjs grant $seconds $child $device"
    local rc=$?
    set -e
    case $rc in
        0) echo "Grant OK: the session works on $remote." ;;
        2) echo "Session rejected on $remote (exit 2). Try the other browser, or re-run just fl-login + fl-host-setup." >&2 ;;
        *) echo "Grant failed (exit $rc)." >&2 ;;
    esac
    exit $rc
}

case $action in
    setup) setup "${2:-}" ;;
    grant) grant "${2:-}" "${3:-}" ;;
    *) echo "usage: fl-host.sh setup [browsers] | grant <seconds> [browser]" >&2; exit 2 ;;
esac
