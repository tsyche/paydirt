#!/usr/bin/env bash
# Control the PayDirt unit on the deploy host:
#   service-remote.sh restart|status|logs [N]
#   service-remote.sh backup-pull    copy the host's nightly backup zips to ./backups/host/ (keeps newest 30)
#   service-remote.sh reset-data     back up, then WIPE the host DB (asks you to type the host name); prints a new superuser password
#   service-remote.sh push-updates   mirror local pocketbase/pb_data/updates (APK + OTA) to the host
set -euo pipefail

repo_dir=$(cd "$(dirname "$0")/.." && pwd)
source "$repo_dir/scripts/deploy-host.sh"
remote=$(read_deploy_host "$repo_dir")
action=${1:?usage: service-remote.sh restart|status|logs [N]|backup-pull|push-updates|reset-data}
lines=${2:-50}
if [[ $action == backup-pull || $action == push-updates ]]; then
    stage=$(ssh "$remote" 'mktemp -d /tmp/paydirt-service.XXXXXX')
    trap 'ssh "$remote" "rm -rf -- \"$stage\"" >/dev/null 2>&1 || true' EXIT
fi
[[ $lines =~ ^[0-9]{1,4}$ ]] || { echo "line count must be a number" >&2; exit 2; }
case $action in
    restart) ssh -t "$remote" 'sudo systemctl restart paydirt && systemctl is-active paydirt' ;;
    status) ssh -t "$remote" 'systemctl status paydirt --no-pager' ;;
    logs) ssh -t "$remote" "sudo journalctl -u paydirt -n $lines --no-pager" ;;
    backup-pull)
        dest="$repo_dir/backups/host"
        mkdir -p "$dest" && chmod 700 "$repo_dir/backups" "$dest"
        # The backups dir is paydirt-owned (750); stage a readable copy first.
        ssh -t "$remote" "sudo sh -c 'ls /var/lib/paydirt/backups/*.zip >/dev/null 2>&1 && cp -p /var/lib/paydirt/backups/*.zip \"$stage\"/ && chown -R \"\$SUDO_USER\" \"$stage\"'" ||
            { echo "No backups on the host yet (first one runs at 02:30 after update-service)." >&2; exit 1; }
        rsync -t --chmod=F600 "$remote:$stage/"*.zip "$dest/"
        # shellcheck disable=SC2012
        ls -t "$dest"/*.zip | tail -n +31 | while read -r old; do rm -f -- "$old"; done
        echo "Backups in $dest:"; ls -1 "$dest" ;;
    push-updates)
        src="$repo_dir/pocketbase/pb_data/updates"
        [[ -d $src ]] || { echo "Nothing to push: $src does not exist (run just publish-apk / update-publish first)." >&2; exit 1; }
        rsync -rt "$src/" "$remote:$stage/"
        ssh -t "$remote" "sudo install -d -o paydirt -g paydirt -m 750 /var/lib/paydirt/updates && sudo rsync -rt --chown=paydirt:paydirt \"$stage\"/ /var/lib/paydirt/updates/ && echo 'Updates mirrored to /var/lib/paydirt/updates.'" ;;
    reset-data)
        echo "This WIPES all PayDirt data on $remote (users, chores, ledger, photos) after saving a snapshot."
        read -r -p "Type the host name ($remote) to continue: " confirm
        [[ $confirm == "$remote" ]] || { echo "Cancelled." >&2; exit 1; }
        stage=$(ssh "$remote" 'mktemp -d /tmp/paydirt-reset.XXXXXX')
        trap 'ssh "$remote" "rm -rf -- \"$stage\"" >/dev/null 2>&1 || true' EXIT
        rsync -t "$repo_dir/scripts/host-reset.sh" "$remote:$stage/"
        ssh -tt "$remote" "bash '$stage/host-reset.sh' '${PB_ADMIN_EMAIL:-admin@paydirt.local}'" ;;
    *) echo "unsupported action: $action" >&2; exit 2 ;;
esac
