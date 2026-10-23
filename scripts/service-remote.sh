#!/usr/bin/env bash
# Control the PayDirt unit on the deploy host: service-remote.sh restart|status|logs [N]
set -euo pipefail

repo_dir=$(cd "$(dirname "$0")/.." && pwd)
source "$repo_dir/scripts/deploy-host.sh"
remote=$(read_deploy_host "$repo_dir")
action=${1:?usage: service-remote.sh restart|status|logs [N]}
lines=${2:-50}
[[ $lines =~ ^[0-9]{1,4}$ ]] || { echo "line count must be a number" >&2; exit 2; }
case $action in
    restart) ssh -t "$remote" 'sudo systemctl restart paydirt && systemctl is-active paydirt' ;;
    status) ssh -t "$remote" 'systemctl status paydirt --no-pager' ;;
    logs) ssh -t "$remote" "sudo journalctl -u paydirt -n $lines --no-pager" ;;
    *) echo "unsupported action: $action" >&2; exit 2 ;;
esac
