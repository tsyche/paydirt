#!/usr/bin/env bash
# Deploy PayDirt to the Linux host named in deploy.local.env (see docs/DEPLOYMENT.md).
#   update-service.sh            ship hooks, migrations, dashboard, unit; restart; health check
#   update-service.sh --install  first install: also create the user/dirs and import local pb_data
# Never touches the host's pb_data after the first import, or /etc/paydirt.
set -euo pipefail

repo_dir=$(cd "$(dirname "$0")/.." && pwd)
source "$repo_dir/scripts/deploy-host.sh"
remote=$(read_deploy_host "$repo_dir")
mode=${1:-}
[[ -z $mode || $mode == --install ]] || { echo "usage: update-service.sh [--install]" >&2; exit 2; }

if [[ ! -t 0 ]]; then
    echo "Run this from a terminal so remote sudo can prompt for your password." >&2
    exit 1
fi
for command in ssh rsync pnpm; do
    if ! command -v "$command" >/dev/null 2>&1; then
        echo "Missing command: $command" >&2
        exit 1
    fi
done

# The host runs the same PocketBase version as local dev (hooks/migrations target it).
pb_version=${PB_VERSION:-$("$repo_dir/pocketbase/pocketbase" --version | awk '{print $3}')}
if [[ ! $pb_version =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "Could not determine the PocketBase version (run just pb-download, or set PB_VERSION)." >&2
    exit 1
fi

import_data=0
if [[ $mode == --install && -f $repo_dir/pocketbase/pb_data/data.db ]]; then
    if curl -sf -o /dev/null --max-time 2 http://127.0.0.1:3111/api/health; then
        echo "Local PocketBase is running; stop it (just stop) so pb_data is copied consistently." >&2
        exit 1
    fi
    import_data=1
fi

echo "Building web dashboard (static export)..."
(cd "$repo_dir" && NEXT_PUBLIC_POCKETBASE_URL=/ pnpm --filter web build >/dev/null)

stage=$(ssh "$remote" 'mktemp -d /tmp/paydirt-update.XXXXXX')
cleanup() { ssh "$remote" "rm -rf -- '$stage'" >/dev/null 2>&1 || true; }
trap cleanup EXIT

rsync -rt \
    "$repo_dir/pocketbase/pb_hooks" "$repo_dir/pocketbase/pb_migrations" \
    "$repo_dir/pocketbase/paydirt.service" "$repo_dir/scripts/host-apply.sh" \
    "$repo_dir/pocketbase/paydirt-fl.service" "$repo_dir/pocketbase/paydirt-fl.path" \
    "$repo_dir/scripts/fl-host-code.sh" \
    "$repo_dir/scripts/familylink-grant.mjs" "$repo_dir/scripts/familylink-worker.mts" \
    "$repo_dir/packages/shared/src/familylink.ts" "$repo_dir/packages/shared/src/familylinkQueue.ts" \
    "$remote:$stage/"
rsync -rt "$repo_dir/apps/web/out/" "$remote:$stage/pb_public/"
if [[ $import_data -eq 1 ]]; then
    echo "Copying local pb_data for the first install..."
    rsync -rt --exclude='*.log' "$repo_dir/pocketbase/pb_data/" "$remote:$stage/pb_data/"
fi

ssh -tt "$remote" "bash '$stage/host-apply.sh' '$stage' '$pb_version' $mode"

host_addr=$(ssh -G "$remote" | awk '$1 == "hostname" {print $2; exit}')
sleep 2
for _ in 1 2 3 4 5 6 7 8 9 10; do
    if ssh "$remote" 'curl -fsS --max-time 3 http://127.0.0.1:3111/api/health' >/dev/null 2>&1; then
        echo "PayDirt on $remote is healthy: http://$host_addr:3111 (dashboard), http://$host_addr:3111/_/ (admin)."
        exit 0
    fi
    sleep 2
done

echo "PayDirt did not report healthy. Check: just service-logs" >&2
exit 1
