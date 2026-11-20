#!/usr/bin/env bash
# Runs ON the deploy host from the staged copy update-service.sh ships:
#   host-apply.sh <stage_dir> <pb_version> [--install]
# Code under /opt/paydirt is root-owned; only /var/lib/paydirt is writable by the service.
set -euo pipefail

stage=$1 version=$2 mode=${3:-}
cd "$stage"

if ! /usr/bin/node -e 'if (Number(process.versions.node.split(".")[0]) < 24) process.exit(1)' 2>/dev/null; then
    echo "The notification worker requires /usr/bin/node 24+. Install Node 24+ before deploying." >&2
    exit 1
fi

if [[ $mode == --install ]]; then
    id paydirt >/dev/null 2>&1 ||
        sudo useradd --system --home-dir /var/lib/paydirt --shell /usr/sbin/nologin paydirt
    sudo install -d -o root -g root -m 755 /opt/paydirt
    sudo install -d -o paydirt -g paydirt -m 750 /var/lib/paydirt
    sudo install -d -o root -g root -m 700 /etc/paydirt
    if [[ -d pb_data ]]; then
        if sudo test -e /var/lib/paydirt/data.db; then
            echo "Host already has data in /var/lib/paydirt; not importing local pb_data."
        else
            sudo rsync -rt pb_data/ /var/lib/paydirt/
            sudo chown -R paydirt:paydirt /var/lib/paydirt
            echo "Imported local pb_data."
        fi
    fi
fi
if [[ ! -d /var/lib/paydirt ]]; then
    echo "PayDirt is not installed on this host; run: just install-service" >&2
    exit 1
fi

# Pin the binary to the requested version, verified against the release checksums.
if [[ $(/opt/paydirt/pocketbase --version 2>/dev/null | awk '{print $3}') != "$version" ]]; then
    arch=$(uname -m | sed 's/x86_64/amd64/; s/aarch64/arm64/')
    zip="pocketbase_${version}_linux_${arch}.zip"
    base="https://github.com/pocketbase/pocketbase/releases/download/v${version}"
    echo "Installing PocketBase ${version}..."
    curl -fsSLO "$base/$zip"
    curl -fsSLO "$base/checksums.txt"
    grep " ${zip}\$" checksums.txt | sha256sum -c --quiet -
    unzip -q -o "$zip" pocketbase
    sudo install -o root -g root -m 755 pocketbase /opt/paydirt/pocketbase
fi

for dir in pb_hooks pb_migrations pb_public; do
    sudo rsync -rt --delete "$dir/" "/opt/paydirt/$dir/"
done
sudo chown -R root:root /opt/paydirt
bash "$stage/fl-host-code.sh" "$stage"
sudo systemctl stop paydirt-notify.path paydirt-notify.service 2>/dev/null || true
sudo install -d -m 755 /opt/paydirt/notifications/scripts /opt/paydirt/notifications/packages/shared/src
sudo install -m 644 notification-worker.mts /opt/paydirt/notifications/scripts/
sudo install -m 644 notificationQueue.ts /opt/paydirt/notifications/packages/shared/src/
sudo chown -R root:root /opt/paydirt/notifications
sudo install -d -o paydirt -g paydirt -m 700 /var/lib/paydirt/notifications \
    /var/lib/paydirt/notifications/pending /var/lib/paydirt/notifications/processing
sudo install -o root -g root -m 644 paydirt-notify.service paydirt-notify.path /etc/systemd/system/
sudo install -o root -g root -m 644 paydirt.service /etc/systemd/system/paydirt.service
sudo systemctl daemon-reload
sudo systemctl enable --now paydirt-notify.path
# Recover interrupted jobs even if pending/ is empty.
sudo systemctl start paydirt-notify.service
sudo systemctl enable --quiet paydirt
sudo systemctl restart paydirt
sudo systemctl is-active --quiet paydirt
