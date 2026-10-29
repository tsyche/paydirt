#!/usr/bin/env bash
# Runs ON the deploy host (shipped by service-remote.sh reset-data): backs up, then
# wipes PayDirt's database so it can be onboarded fresh. Keeps familylink/ (Google
# session + queue), updates/ (APK + OTA), backups/ and the env file.
# Prints a NEW superuser password once; the old one stops working.
set -euo pipefail

data=/var/lib/paydirt
stamp=$(date +%Y%m%d-%H%M%S)
email=${1:-admin@paydirt.local}

sudo systemctl stop paydirt
sudo install -d -o paydirt -g paydirt -m 750 "$data/backups"
snap="$data/backups/pre-reset-$stamp.tgz"
sudo tar -C "$data" -czf "$snap" --ignore-failed-read data.db data.db-wal data.db-shm auxiliary.db storage
sudo test -s "$snap" || { echo "Backup failed; nothing was wiped." >&2; sudo systemctl start paydirt; exit 1; }
sudo chown paydirt:paydirt "$snap"
echo "Pre-reset snapshot: $snap"

sudo rm -rf "$data"/data.db* "$data"/auxiliary.db* "$data/storage" "$data/.pb_temp_to_delete"
sudo -u paydirt /opt/paydirt/pocketbase migrate up --dir "$data" --migrationsDir /opt/paydirt/pb_migrations >/dev/null
pw=$(head -c 24 /dev/urandom | base64 | tr -dc 'a-zA-Z0-9' | head -c 20)
sudo -u paydirt /opt/paydirt/pocketbase superuser upsert "$email" "$pw" --dir "$data" >/dev/null
sudo systemctl start paydirt
echo "Database wiped and rebuilt empty."
echo "Superuser: $email / $pw   (shown once - save it in your password manager)"
