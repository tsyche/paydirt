#!/usr/bin/env bash
# Sourced by the service scripts: read_deploy_host <repo_dir> [override]

read_deploy_host() {
    local repo_dir=$1 override=${2:-} host='' key='' value=''
    local config="$repo_dir/deploy.local.env"
    if [[ -f $config ]]; then
        while IFS='=' read -r key value; do
            if [[ $key == PAYDIRT_SSH_HOST ]]; then
                host=$value
            fi
        done < "$config"
    fi
    host=${override:-${PAYDIRT_SSH_HOST:-$host}}
    if [[ ! $host =~ ^[A-Za-z0-9][A-Za-z0-9._-]*$ ]]; then
        echo "Set PAYDIRT_SSH_HOST in deploy.local.env or pass an SSH alias." >&2
        return 1
    fi
    printf '%s\n' "$host"
}
