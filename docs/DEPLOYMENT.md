# Deployment (always-on host)

**TL;DR:** PayDirt runs on a Linux host (bb) as one systemd service: PocketBase serves the API, the admin UI and the static parent dashboard on port 3111. `just install-service` once, then `just update-service` after every change. The host's data stays put across updates. Family Link bonus-time grants run on the host with a session copied from the Mac (`just fl-host-setup`).

## Layout on the host

| Path | Owner | Contents |
|---|---|---|
| `/opt/paydirt/` | root | `pocketbase` binary, `pb_hooks/`, `pb_migrations/`, `pb_public/` (dashboard) |
| `/var/lib/paydirt/` | `paydirt` (750) | `pb_data`: SQLite DBs, uploaded files, `updates/` (APK + OTA) |
| `/etc/paydirt/paydirt.env` | root (600, optional) | env overrides, e.g. `NTFY_SERVER=...` |
| `/etc/systemd/system/paydirt.service` | root | from [`pocketbase/paydirt.service`](../pocketbase/paydirt.service) |
| `/opt/paydirt/familylink/` | root | Family Link grant script, `playwright`, Playwright browsers (see [below](#family-link-grants)) |
| `/var/lib/paydirt/familylink/` | `paydirt` (700) | Google session (`familylink-state.json`, 600) |

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

## Family Link grants

Bonus screen time is granted through the Family Link web API ([`scripts/familylink-grant.mjs`](../scripts/familylink-grant.mjs)). Google rejects sign-in from automated browsers, so you sign in on the Mac and copy the session to the host.

Each grant reads the target device's active bonus and sets the bonus to remaining + purchased seconds. The calculation uses Google's server time and rounds remaining seconds up. Failed reads, missing devices, malformed responses, or unsupported active overrides stop the grant without writing. Run grants one at a time so their read/write pairs cannot overlap.

1. Mac: `just fl-login` (sign in to the co-parent account by hand, then quit that Chrome). Needs `~/.config/paydirt/familylink.env` with `FL_CHILD_ID`, `FL_DEVICE_ID`, `FL_API_KEY`.
2. `just fl-host-setup [browsers]` (default `firefox`; `"firefox chromium"` for both). It is idempotent and:
   - installs Node 24 from the NodeSource apt repo (pinned over the distro's `nodejs`);
   - installs the script, `playwright` (the Mac's version) and Playwright's own browser builds under `/opt/paydirt/familylink/`. Stock `/usr/bin/firefox` can't be used, because Playwright drives only its patched builds;
   - copies the session to `/var/lib/paydirt/familylink/` and sets `FL_API_KEY` in `/etc/paydirt/paydirt.env`.
3. `just fl-host-grant <seconds> [firefox|chromium]` runs a test grant as `paydirt` through `systemd-run`, outside the PocketBase unit's memory/CPU limits. Exit 2 = session rejected or expired.

After any new `fl-login` or grant-script/helper change, re-run `just fl-host-setup` to copy the session and code over again. `just update-service` does not yet deploy the Family Link scripts.

Not yet automated: backups of `/var/lib/paydirt`, and pointing `just publish-apk` / `just update-publish` at the host (they still write local `pb_data/updates`). See [ROADMAP.md](../ROADMAP.md).
