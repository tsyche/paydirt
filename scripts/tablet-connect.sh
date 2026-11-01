#!/usr/bin/env bash
# Connect every tablet listed in DEPLOY_DEVICES env or ./deploy-devices.
# Per entry: entry as-is → ip:5555 (fixed port via `adb tcpip 5555`) → mDNS.
# Exits 0 if at least one device ended up connected, 1 if none did.
set -uo pipefail

entries="${DEPLOY_DEVICES:-}"
if [ -z "${entries}" ] && [ -f deploy-devices ]; then
    entries=$(grep -vE '^[[:space:]]*(#|$)' deploy-devices | tr '\n' ' ')
fi
if [ -z "${entries}" ]; then
    printf '\033[0;33mNo deploy-devices config. Create it (repo root), one "ip:port" or bare IP per\n'
    printf 'line — after pairing once, run '\''adb -s <serial> tcpip 5555'\'' and a bare IP\n'
    printf 'keeps working until the tablet reboots (see just deploy-start).\033[0m\n'
    exit 1
fi

# `adb connect` has no timeout and hangs on a dead IP; macOS lacks timeout(1), so use perl.
adb_connect() { perl -e 'alarm 8; exec @ARGV' adb connect "$1" 2>&1 || true; }

# Connected on a random Wireless Debugging port: switch adbd to fixed 5555 and drop the old port.
pin_5555() {
    local host="$1" serial="$2"
    printf '\033[0;36mPinning %s to port 5555 (was %s)...\033[0m\n' "${host}" "${serial}"
    adb -s "${serial}" tcpip 5555 >/dev/null 2>&1 || return 1
    sleep 2
    adb disconnect "${serial}" >/dev/null 2>&1 || true
    for _ in 1 2 3; do
        adb_connect "${host}:5555" >/dev/null
        if adb devices | awk '$2 == "device" {print $1}' | grep -qx "${host}:5555"; then
            printf '\033[0;32mconnected to %s:5555\033[0m\n' "${host}"
            return 0
        fi
        sleep 2
    done
    printf '\033[0;33mCould not reach %s:5555 after tcpip; still try: adb connect %s:5555\033[0m\n' "${host}" "${host}"
    return 1
}

connect_one() {
    local e="$1" host res port
    host="${e%%:*}"
    # already connected: fine on 5555; on a random Wireless Debugging port, pin it to 5555
    local have
    have=$(adb devices | awk '$2 == "device" {print $1}' | grep "^${host}:" | head -1)
    if [[ -n "${have}" ]]; then
        if [[ "${have}" == "${host}:5555" ]]; then
            printf '\033[0;32malready connected to %s\033[0m\n' "${host}"
            return 0
        fi
        pin_5555 "${host}" "${have}" || true
        return 0
    fi
    # entry as-is (skipped for bare IPs, which have no port), then ip:5555
    if [[ "${e}" == *:* ]]; then
        res=$(adb_connect "${e}")
        if [[ "${res}" == *"connected to"* && "${res}" != *"failed"* ]]; then
            printf '\033[0;32m%s\033[0m\n' "${res}"
            return 0
        fi
    fi
    res=$(adb_connect "${host}:5555")
    if [[ "${res}" == *"connected to"* && "${res}" != *"failed"* ]]; then
        printf '\033[0;32m%s\033[0m\n' "${res}"
        return 0
    fi
    port=$(adb mdns services 2>/dev/null | awk -v h="${host}" '$4==h {print $5; exit}')
    if [[ -n "${port}" ]]; then
        res=$(adb_connect "${host}:${port}")
        if [[ "${res}" == *"connected to"* && "${res}" != *"failed"* ]]; then
            printf '\033[0;32m%s\033[0m\n' "${res}"
            pin_5555 "${host}" "${host}:${port}" || true
            return 0
        fi
    fi
    return 1
}

ok=0
for e in ${entries}; do
    if connect_one "${e}"; then
        ok=$((ok + 1))
    else
        printf '\033[0;33mFailed to reach %s (also tried %s:5555 + mDNS).\033[0m\n' "${e}" "${e%%:*}"
        printf '\033[0;33m  Tablet asleep/off, wrong IP/VLAN, or rebooted (reboot resets the debug port).\033[0m\n'
        printf '\033[0;33m  One-time per reboot: pair from the Wireless debugging screen if needed, then\n'
        printf '\033[0;33m  run '\''adb -s <serial> tcpip 5555'\'' — entries then auto-fall-back to 5555.\033[0m\n'
    fi
done

[[ ${ok} -gt 0 ]]
