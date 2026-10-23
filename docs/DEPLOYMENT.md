# Deployment (always-on host)

**TL;DR:** PayDirt runs on a Linux host (bb) as one systemd service: PocketBase serves the API, the admin UI and the static parent dashboard on port 3111. `just install-service` once, then `just update-service` after every change. The host's data stays put across updates.

## Layout on the host

| Path | Owner | Contents |
|---|---|---|
| `/opt/paydirt/` | root | `pocketbase` binary, `pb_hooks/`, `pb_migrations/`, `pb_public/` (dashboard) |
| `/var/lib/paydirt/` | `paydirt` (750) | `pb_data`: SQLite DBs, uploaded files, `updates/` (APK + OTA) |
| `/etc/paydirt/paydirt.env` | root (600, optional) | env overrides, e.g. `NTFY_SERVER=...` |
| `/etc/systemd/system/paydirt.service` | root | from [`pocketbase/paydirt.service`](../pocketbase/paydirt.service) |

The unit runs as the unprivileged `paydirt` user with `ProtectSystem=strict`; only `/var/lib/paydirt` is writable. It listens on `0.0.0.0:3111` (LAN only — no public exposure).

## First install

1. `cp deploy.example.env deploy.local.env` and set `PAYDIRT_SSH_HOST` to the host's SSH alias (`bb`).
2. Stop local PocketBase (`just stop`) so its data copies cleanly.
3. `just install-service` from a terminal (remote `sudo` prompts). It:
   - creates the `paydirt` system user and the directories above;
   - imports local `pocketbase/pb_data` **only if** the host has no `data.db` yet;
   - then does everything `update-service` does.
4. Point the apps at the host:
   - Mobile: set `EXPO_PUBLIC_POCKETBASE_URL=http://<host-ip>:3111` in `apps/mobile/.env`, then `just push` (the URL is baked into the APK).
   - Dashboard: `http://<host-ip>:3111/` (admin UI at `/_/`).
5. Kids' VLAN (br1) needs a router LAN Access rule allowing `192.168.20.0/24` → `<host-ip>:3111`.

## Updates

`just update-service` builds the dashboard as a static export (`NEXT_PUBLIC_POCKETBASE_URL=/`, same origin), stages it with the hooks, migrations and unit in a private temp dir on the host, then:

- installs the PocketBase version matching local `pocketbase/pocketbase --version` (override with `PB_VERSION`), verified against the release's `checksums.txt`; skipped if already current;
- syncs `/opt/paydirt/`, reinstalls the unit, restarts, and polls `/api/health` on loopback.

Migrations run automatically on restart. No commit or push is needed to deploy local changes.

## Operations

| Task | Command |
|---|---|
| Status | `just service-status` |
| Logs | `just service-logs [N]` |
| Restart | `just service-restart` |

Not yet automated: backups of `/var/lib/paydirt`, and pointing `just publish-apk` / `just update-publish` at the host (they still write local `pb_data/updates`). See [ROADMAP.md](../ROADMAP.md).
