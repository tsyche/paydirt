# Server-free feasibility evidence

## TL;DR

Offline completion and duplicate-safe settlement work in a small signed-operation model and a three-browser WebRTC experiment. This does not establish a server-free replacement: Android transport, authority recovery, external grants, and browser pairing remain unproven. Keep PocketBase in production while testing those constraints. Iroh screening now supports a bounded LAN harness, but hosted-relay economics and native/browser integration remain blockers to production selection.

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

## 2026-11-08 — Iroh dependency and cost screen

**Gate 0 result: conditional go for an isolated Android LAN harness; no production selection.** A mandatory developer-funded managed relay does not meet the stated cost constraint. Public/community capacity has not been established as a sustainable substitute. No dependency was installed into PayDirt, no account was created, and no device or cross-network transport was tested in this screen.

### Source and artifact checks

| Check | Observed result | Consequence / remaining proof |
|---|---|---|
| Published Android artifact | Maven Central lists `computer.iroh:iroh-android:1.2.0`; the upstream FFI release is `v1.2.0` (2026-10-22). | Pin this candidate for a reproducible harness rather than follow `main`. |
| Source identity | The `v1.2.0` Git tree API returned tree SHA `66a8d619a4d791d458d582f312df6e0ab42bc541`. | This identifies the inspected source tree, not an independently verified binary checksum. |
| License declarations | FFI source offers MIT or Apache-2.0; published Android/JVM POMs declare both. | No obvious license blocker at screening; retain required notices and review transitive licenses before distribution. |
| Android packaging | Tagged Android module targets minimum API 24, Java/Kotlin JVM target 17; Android initialization calls `IrohAndroid.installAndroidContext(context)` before endpoints. | PayDirt also targets minimum API 24. APK packaging, ABI compatibility, native loading and device behavior remain untested. |
| Google independence | Examined direct Android/JVM POM dependencies are Iroh, JNA, Kotlin and coroutines; initialization uses Android `Context`. No direct Play Services dependency was found. | This is source/POM evidence, not a verified resolved dependency graph or Google-free device result. |
| Kotlin compatibility | Published POMs request Kotlin stdlib 2.2.21; PayDirt's React Native catalog uses Kotlin 2.1.20. | A build gate is required. Do not upgrade production Kotlin or suppress metadata checks merely to force the spike through. |
| Expo integration | PayDirt already has a Kotlin native-module seam. Expo supports custom Kotlin modules in native builds. | The FFI Node.js binding is not evidence of React Native compatibility. A Kotlin bridge plus rebuilt APK, or a standalone harness, is required; Expo Go/JS-only OTA cannot add the native library. |
| Direct-only mode | Tagged endpoint source exposes a minimal preset without external services. Its relay-disabled n0 preset is distinct from that minimal preset. | Use minimal mode plus explicitly exchanged addresses for LAN proof; disabling relays alone does not establish zero discovery dependencies. |
| Protocol scope | FFI README covers endpoints/connections and excludes the higher-level blobs/docs/gossip protocols. | Do not assume document replication or durable operation storage is supplied by the binding. |
| Browser | An upstream Wasm example explicitly uses relay-only connectivity because browser sockets are restricted. | Browser parity is a separate gate; do not label the npm Node binding a browser implementation or assume server-free browser LAN connectivity. |

Primary sources checked: [release](https://github.com/n0-computer/iroh-ffi/releases/tag/v1.2.0), [Android Maven metadata](https://repo.maven.apache.org/maven2/computer/iroh/iroh-android/maven-metadata.xml), [Android POM](https://repo.maven.apache.org/maven2/computer/iroh/iroh-android/1.2.0/iroh-android-1.2.0.pom), [JVM POM](https://repo.maven.apache.org/maven2/computer/iroh/iroh/1.2.0/iroh-1.2.0.pom), [tagged Android build](https://github.com/n0-computer/iroh-ffi/blob/v1.2.0/kotlin/android/build.gradle.kts), [initializer](https://github.com/n0-computer/iroh-ffi/blob/v1.2.0/kotlin/android/src/main/kotlin/computer/iroh/IrohAndroid.kt), [endpoint presets](https://github.com/n0-computer/iroh-ffi/blob/v1.2.0/src/endpoint.rs), [FFI scope/license](https://github.com/n0-computer/iroh-ffi), [Expo custom native code](https://docs.expo.dev/workflow/customizing/), [upstream browser example](https://github.com/n0-computer/iroh-esp32-examples/blob/main/wasm-gui/README.md).

### Hosted infrastructure and illustrative cost

The [vendor pricing page](https://www.iroh.computer/pricing), checked 2026-11-08, describes rate-limited public Community relays without uptime guarantees. Pro lists a $19 monthly base, 10,000 included concurrent connections, $0.003 per additional endpoint, and 100 GB included egress with $0.09/GB overage. These are published list figures, not a negotiated quote or proof that a given adoption level is supported.

The following scenarios are hypothetical sensitivity calculations, **not measured usage forecasts**. Assume all households are active, decimal MB/GB, a shared Pro relay, and endpoint billing as described above. Exclude metrics, taxes, support, extra regions, photos/backups beyond the stated bytes, and operating costs. Confirm actual endpoint billing semantics before using these estimates for a decision.

| Scenario | Households | Concurrent endpoints assumed | Relayed GB/month | Illustrative monthly total |
|---|---:|---:|---:|---:|
| 3 devices/household; 10% concurrent; 5 MB sync/household/month; 20% relayed | 100,000 | 30,000 | 100 | $79 |
| Same assumptions | 1,000,000 | 300,000 | 1,000 | $970 |
| 4 devices/household; 25% concurrent; 50 MB sync/household/month; 50% relayed | 100,000 | 100,000 | 2,500 | $505 |
| Same assumptions | 1,000,000 | 1,000,000 | 25,000 | $5,230 |

Formula: `19 + max(0, endpoints - 10000) * 0.003 + max(0, GB - 100) * 0.09`. This extrapolates list pricing beyond an established service capacity; large deployments may require different plans. Even tiny application records do not eliminate connection costs. Community availability/limits, production terms, abuse controls, and discovery metadata handling still need review. No unlimited free capacity or uptime commitment was found in the examined material.

### Next bounded experiment

1. Use a separate disposable Android harness pinned to the published 1.2.0 artifact. Resolve the dependency graph and verify native library loading before bridging into the Expo app. The Kotlin-version difference makes this the cheaper initial path.
2. Configure minimal/direct-only endpoints, exchange authenticated peer IDs and explicit addresses out of band, and allow only the paired identity. Mark QR/code provisioning as experimental, not production enrollment.
3. On two physical Android devices, record a fake completion offline, reconnect over the same Wi-Fi, exchange it, restart, and replay it. Confirm durable storage and duplicate suppression; record route and bytes. Explicit addressing proves transport, not automatic discovery or NAT traversal.
4. Only after LAN proof, test cross-network direct/relay behavior and measure the cost inputs above. Do not enable paid services or add real Google credentials.

Physical devices are not currently available through `adb`; the screening performed no native build or device test. Bluetooth, Android background behavior, pairing recovery, and full browser support remain unproven. If Iroh's device or economics gate fails, compare Syncthing immutable-record delivery and Briar/Bramble before building a custom networking stack.

## Recommendation and next gate

The [Draft experiment plan](../plans/server-free-spike.md) (restructured 2026-11-09) moves policy/reducer modelling ahead of device work and proposes public Nostr mailboxes as the primary transport, because direct peer-to-peer transports require both devices awake at once. Iroh is demoted to an optional LAN accelerator. It does not select a production architecture.

Keep the existing backend and ledger unchanged. A single designated settlement device is a useful experiment, but not yet a recommendation for the full product: losing it must not strand the household or permit two recovered authorities to issue grants.

The next experiment is bounded physical-device transport/recovery: two Android devices plus a browser, offline completion, reconnect, simultaneous decisions, restart during settlement, authority-device loss, revocation propagation, and cross-network catch-up. Record foreground/background behavior and Google-executor custody. No migration is approved.

**Open decision:** Are optional public encrypted relays/signaling and static hosting acceptable? Without them, assess a local-network/manual-sync mode explicitly; do not promise immediate cross-network delivery with all household devices asleep.

A later migration proposal must include signed snapshot/export validation, ledger-total comparisons, device enrollment, schema-version handling, and a cutover freeze. Never run old and new grant executors concurrently. Rollback must reconcile operations and irreversible grants since cutover before re-enabling PocketBase; restoring an old database alone is insufficient.
