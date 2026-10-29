#!/usr/bin/env bash
# Runs on the host: install staged code/units without touching browser auth.
# Both fl-host-setup and update-service call this after their prerequisites.
set -euo pipefail
stage=$1
dest=/opt/paydirt/familylink
state=/var/lib/paydirt/familylink

if systemctl cat paydirt-fl.service >/dev/null 2>&1; then
    # An interrupted attempt is recovered as manual review, never replayed.
    sudo systemctl stop paydirt-fl.path paydirt-fl.service
fi
sudo install -d -m 755 "$dest/scripts" "$dest/packages/shared/src"
sudo install -m 644 "$stage/familylink-grant.mjs" "$stage/familylink-worker.mts" "$dest/scripts/"
sudo install -m 644 "$stage/familylink.ts" "$stage/familylinkQueue.ts" "$dest/packages/shared/src/"
sudo chown -R root:root "$dest"
sudo install -d -o paydirt -g paydirt -m 700 "$state" "$state/queue" \
    "$state/queue/pending" "$state/queue/processing" "$state/queue/results"
sudo install -m 644 "$stage/paydirt-fl.service" "$stage/paydirt-fl.path" /etc/systemd/system/
sudo systemctl daemon-reload
if [[ -f $dest/package.json ]] && sudo test -f "$state/familylink-state.json"; then
    sudo systemctl enable --now paydirt-fl.path
    # Recover claimed jobs even when pending/ is empty after an interrupted run.
    sudo systemctl start paydirt-fl.service
fi
