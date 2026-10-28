#!/usr/bin/env bash
# Runs ON the deploy host (via fl-host.sh setup): fl-host-apply.sh <stage-dir> <playwright-version> <browsers>
# Idempotent. Code + browsers under /opt/paydirt/familylink are root-owned and read-only to
# the service; only the session in /var/lib/paydirt/familylink is writable by paydirt.
set -euo pipefail

stage=$1
pw_version=$2
browsers=$3
dest=/opt/paydirt/familylink
state_dir=/var/lib/paydirt/familylink
env_file=/etc/paydirt/paydirt.env

[[ $pw_version =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "bad playwright version: $pw_version" >&2; exit 2; }

node_major() { { node --version 2>/dev/null || echo v0; } | sed -E 's/^v([0-9]+).*/\1/'; }

if [[ $(node_major) -lt 24 ]]; then
    echo "Installing Node 24 from NodeSource..."
    sudo install -d -m 755 /etc/apt/keyrings
    curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key |
        sudo gpg --dearmor --yes -o /etc/apt/keyrings/nodesource.gpg
    echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_24.x nodistro main" |
        sudo tee /etc/apt/sources.list.d/nodesource.list >/dev/null
    # Prefer NodeSource's nodejs over the distro/Pop repos' older one.
    printf 'Package: nodejs\nPin: origin deb.nodesource.com\nPin-Priority: 1002\n' |
        sudo tee /etc/apt/preferences.d/nodesource >/dev/null
    sudo apt-get update -qq
    sudo apt-get install -y -qq nodejs
fi
[[ $(node_major) -ge 24 ]] || { echo "Node 24+ required; got $(node --version)" >&2; exit 1; }
echo "Node $(node --version)"

echo "Installing grant script + playwright $pw_version under $dest..."
sudo install -d -m 755 "$dest" "$dest/scripts" "$dest/packages/shared/src"
sudo install -m 644 "$stage/familylink-grant.mjs" "$dest/scripts/"
sudo install -m 644 "$stage/familylink.ts" "$dest/packages/shared/src/"
printf '{"private":true,"type":"module","dependencies":{"playwright":"%s"}}\n' "$pw_version" |
    sudo tee "$dest/package.json" >/dev/null
(cd "$dest" && sudo npm install --ignore-scripts --no-audit --no-fund --loglevel=error)
# shellcheck disable=SC2086 # browsers is a space-separated list
sudo env PLAYWRIGHT_BROWSERS_PATH="$dest/browsers" "$dest/node_modules/.bin/playwright" install --with-deps $browsers
sudo chown -R root:root "$dest"
sudo chmod -R a+rX "$dest"

echo "Copying session to $state_dir..."
sudo install -d -o paydirt -g paydirt -m 700 "$state_dir"
sudo install -o paydirt -g paydirt -m 600 "$stage/familylink-state.json" "$state_dir/familylink-state.json"

echo "Setting FL_API_KEY in $env_file..."
sudo touch "$env_file"
sudo chmod 600 "$env_file"
sudo sed -i '/^FL_API_KEY=/d' "$env_file"
sudo tee -a "$env_file" <"$stage/fl.env" >/dev/null

echo "Done. Test with: just fl-host-grant 60"
