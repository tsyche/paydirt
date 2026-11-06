# Server-free feasibility evidence

## TL;DR

Offline completion and duplicate-safe settlement work in a small signed-operation model and a three-browser WebRTC experiment. This does not establish a server-free replacement: Android transport, authority recovery, external grants, and browser pairing remain unproven. Keep PocketBase in production while testing those constraints.

## Scope and observed evidence

2026-11-06 investigation, using fake household data only. The executable [model](../../packages/shared/src/serverFree.spike.test.ts) uses three independent SQLite files and Ed25519 device keys. It is test-only and is not exported by the shared package.

Run it with `pnpm --filter @paydirt/shared test serverFree.spike`.

Four tests demonstrate:

- A kid records completion offline; two parent replicas catch up and approve independently. A designated settlement replica credits the occurrence once despite repeated messages and restart.
- A settled rejection survives a delayed competing approval. Decisions arriving before settlement use operation-ID order; this is a model convention, not an approved product policy.
- Signature checks, role checks, child identity, operation-ID collision detection, and locally updated membership reject invalid operations. A new membership epoch rejects old messages.
- Child catch-up exports filter sibling operations.

The tests call replicas in one process. They do **not** test physical devices, discovery, radio transport, background execution, encrypted storage/transport, pairing, membership propagation, authoritative household configuration, arbitrary reward validation, or schema upgrades. The model uses a fixed five-Grit reward and already-trusted membership. It is not a production security protocol.

## Browser transport evidence

The [Playwright experiment](../../apps/web/e2e/server-free-spike.spec.ts) passes with three isolated Chromium contexts, each with its own IndexedDB database and WebCrypto Ed25519 key. It runs in the existing headless Playwright Docker image; no desktop browser is opened.

The kid records completion with its browser network set offline, before any peer connection exists. After reconnecting, real WebRTC data channels carry signed completion and approval operations. Two parents approve independently; duplicate messages still produce one five-Grit settlement. Reloading the authority page preserves its key, operations, and settlement. A local membership removal rejects the kid's next incoming message.

This is same-host browser evidence, not a native or cross-network result. The test runner passes public keys and SDP between peers out of band. It intercepts the initial HTTPS peer document instead of proving app delivery/hosting. There is no STUN/TURN service configured. Pairing UI, membership persistence/propagation, device loss, authority failover, encrypted backups, child privacy, arbitrary reward validation, and Google execution remain unproven. Keys are exportable for this experiment; production key custody is undecided. Only the designated parent can settle. No server-free product UI is added.

## Parity and gap matrix

| Capability | Evidence or safe proposed behavior | Unproven work |
|---|---|---|
| Offline chore completion | Durable local SQLite/IndexedDB operations; browser WebRTC catch-up | Native SQLite adapter, photos, device clock tampering |
| Parent approvals and duplicate payout | One settlement authority, one unique occurrence row | Replicated signed settlement receipts, authority transfer/failover |
| Multiple offline parents | Record provisional decisions; finalize when authority returns | Product conflict policy and device test; independent irreversible finality is not established |
| Spending and banked time | Keep requests pending until authoritative balance validation | Offline reservations or spend rights, concurrent purchase/reversal rules |
| Race chores | One authoritative winner could settle the race group | Group identity, concurrent different-child claims, partial credit/reversal tests |
| Timers and recurrence | Store elapsed evidence and explicit household occurrence IDs | Trusted time, timezone/DST edits, offline timer proofs, duplicate recurrence |
| Private kid data | Filtered operation export modeled | Authenticated pairing, per-recipient encryption, metadata protection |
| Revocation and recovery | Local removal modeled and browser-tested; epoch rejection modeled | Offline peer revocation propagation, trusted backup, device-loss recovery, membership consensus |
| Notifications | Local reminders can remain useful offline | Reliable remote delivery without Play Services or an always-online relay |
| Family Link | Credentials stay on eligible parent devices; queue while unavailable | Android executor, secure session storage, external-effect deduplication and recovery |
| Remaining parent features | Inventory exists in [FEATURES.md](../../FEATURES.md) | Notes/templates, Kudos, goals, partial credit, archives, help, reports, settings, co-parent membership, photos, updates all require adapters and parity verification |
| Web | Candidate paths assessed below | Physical browser/device pairing, initial delivery, and cross-browser acceptance |

No eligible parent awake means approval settlement and Google delivery wait. This avoids inventing an always-on parent server, but changes availability. Exactly-once local credit does not establish exactly-once external screen-time delivery after a crash.

## Transport and browser assessment

These are source-based constraints and engineering inferences, not device observations.

- [Syncthing](https://docs.syncthing.net/users/syncing.html) synchronizes file blocks and preserves conflicting versions. That is not transaction merging. Replicate authenticated application operations, not a live SQLite file. [SQLite WAL](https://www.sqlite.org/wal.html) also includes state outside the main database file and requires same-host shared memory for active writers.
- [Android Doze and App Standby](https://developer.android.com/training/monitoring-device-state/doze-standby) defer background network activity. Same-host browser catch-up passes; foreground Android LAN catch-up remains a candidate; unattended delivery needs device evidence. LAN discovery across VLANs, changing Wi-Fi networks, NAT traversal, and battery cost are untested.
- [WebRTC](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Signaling_and_video_calling) still needs signaling. A working LAN demonstration would not prove cross-network connectivity. Public signaling, STUN, and potentially TURN are explicit infrastructure dependencies to evaluate; none is silently approved here.

| Web path | Benefit | Constraint |
|---|---|---|
| Paired browser participant | Local data and offline interaction after initial load | Durable browser storage, eviction/recovery, key custody, pairing, signaling, and no dependable always-running background executor |
| Nearby device serves the page | No separate hosting account | Reachability while the device sleeps; local HTTPS/certificate setup and secure-context requirements; cross-network access remains unresolved |
| Optional hosted static frontend | Straightforward HTTPS delivery and cached app shell | External static-hosting dependency; initial load needs connectivity; hosting alone supplies neither sync nor peer discovery |

[Service workers require secure contexts](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API), with localhost treated specially. A browser on another machine visiting a phone's plain LAN IP does not inherit the localhost exception. Do not promise installable offline web access from that arrangement without a tested delivery/TLS solution.

## Recommendation and next gate

Keep the existing backend and ledger unchanged. A single designated settlement device is a useful experiment, but not yet a recommendation for the full product: losing it must not strand the household or permit two recovered authorities to issue grants.

The next experiment is bounded physical-device transport/recovery: two Android devices plus a browser, offline completion, reconnect, simultaneous decisions, restart during settlement, authority-device loss, revocation propagation, and cross-network catch-up. Record foreground/background behavior and Google-executor custody. No migration is approved.

**Open decision:** Are optional public encrypted relays/signaling and static hosting acceptable? Without them, assess a local-network/manual-sync mode explicitly; do not promise immediate cross-network delivery with all household devices asleep.

A later migration proposal must include signed snapshot/export validation, ledger-total comparisons, device enrollment, schema-version handling, and a cutover freeze. Never run old and new grant executors concurrently. Rollback must reconcile operations and irreversible grants since cutover before re-enabling PocketBase; restoring an old database alone is insufficient.
