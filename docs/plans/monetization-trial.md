# Monetization & public Android trial

**TL;DR:** Turn Family Link off for public builds, keep the self-hosted model (no developer hosting at first), and run a free Android sideload trial before charging. Public builds first need runtime server pairing and HTTPS; a paid Play listing (source + sideload stay free) is the simplest revenue path. Hosted tier and iOS come only if the trial shows interest.

**Status:** Draft — discussion recorded 2026-11-20; expanded and code-reviewed 2026-11-24. No execution started.

**Last updated:** 2026-11-24

**Fold into:** [ROADMAP.md](../../ROADMAP.md) backlog, [FEATURES.md](../../FEATURES.md) when scope changes land.

## Framing (decided 2026-11-20)

- **Family Link off entirely for public builds.** Feature-flag / config off in the shipped binary and backend; hiding controls alone is insufficient; code stays in the repo. Manual time grants (Bonus/deduct, including the combined grit+time control) remain the screen-time path. Rationale: the scraped Google session is the ToS-gray, breakable, credential-holding part — wrong thing to put in front of strangers. It also removes the Android-only blocker for any future iOS parity. Revisit only as a possible premium feature of a future hosted tier.
- **No hosting at first.** The product ships as: Android app + self-hosted PocketBase backend the user runs (binary + systemd; a 10-minute setup guide is part of the product). This caps the audience to self-hosters / privacy families — accepted as the point of the trial.
- **Android first, Apple only after signal.** iOS needs a separate release and validation effort (see below); the shared Expo/React Native foundation remains reusable.
- **Positioning shift** with FL off: "privacy-first chore-money system — screen time is a parent decision, not an API call," led by the parentBucks economy rather than auto-grant magic.

## Financial model options (analysis)

| Model | Fit | Notes |
|---|---|---|
| **Free core + one-time paid unlock (prior direction)** | ✅ good | Self-hosters expect one-time pricing (Home Assistant norm). ~$12–20, founder price during trial. |
| **Free source/sideload + paid Play build ("OsmAnd model", proposed 2026-11-24)** | ✅ simplest | Zero licensing code; users pay for store convenience and updates. Paid-upfront apps can be shared through Play Family Library (developer opt-in), so one purchase covers kid devices; in-app purchases generally don't share. Cost: paid-upfront converts worse than free installs. |
| Sideload paid APK via Lemon Squeezy/Gumroad | △ | License key gates premium. In an open-source app a client-side key check is trivially patched out — treat it as honor-system, not enforcement. Confirm current provider fees and terms before selection. |
| Play Store free + one-time IAP | △ | Discovery + billing, $25 console, store assets, review. IAP needs Play present, so sideload users still need a separate key path — two entitlement systems to maintain. App has no Play Services *runtime* deps, so listing is allowed (GrapheneOS users run sandboxed Play). |
| Fully free + donations | ⚠️ floor only | Fine as permanent self-host tier; weak as the model. |
| Subscription | ❌ now | Feels wrong for a self-hosted binary; only makes sense attached to hosted value later. |
| Hosted tier $3–5/mo | △ phase 2 | Recurring revenue option, not the only route to scale. The household schema is a starting point, not proof of production tenant isolation or capacity. Requires ops, security, cost, and support validation. |

**Lean:** free trial first (no payment code until households retain), then either the paid Play build or a one-time unlock. The paid Play build avoids writing license code. Revenue is validation, not the goal of trial 1.

**Reality check:** with Family Link off, the core (chores → currency → approval) competes with free, established apps. The defensible angle is privacy / de-Googled households, which is a small niche. Expect validation-scale revenue, not income.

### Pricing experiments and unit economics

The existing $12–20 founder unlock remains the preferred trial direction. The following are alternative price tests, not approved prices or researched market benchmarks:

- **One-time family unlock: $20–30.** Best fit when users supply their backend or reliable server-free operation eliminates developer-funded infrastructure. One parent purchase should cover paired household devices; entitlement sharing and restoration need design.
- **Annual family subscription: $20–35/year.** Consider only with recurring value such as managed sync, backups, and reliable service. Avoid lifetime hosting promises funded by one-time payments.
- **Free trial, then family unlock.** An alternative to a permanently free core; trial duration and paid boundaries remain open. Free users still create support costs.
- **Paid self-hosted edition or donations.** A niche option with limited mainstream reach because setup remains the user's responsibility.

At $25, 1,000 purchases generate $25,000 gross once; 1,000 annual subscribers generate $25,000 gross per year before churn. Google's listed 15% auto-renewing subscription fee would leave $21,250 before taxes, refunds, support, and infrastructure. This is an illustrative side-business scenario, not a revenue forecast. See [Google service fees](https://support.google.com/googleplay/android-developer/answer/112622?hl=en-en); recheck terms before launch.

Sell software to parents. Keep ads, purchased parentBucks, and real-money transfers out of the initial product.

### Infrastructure boundary

No hosted dashboard does **not** mean no backend: today's app requires PocketBase. The existing self-hosted trial remains the recorded direction. The [server-free spike](server-free-spike.md) is an experiment, not an approved migration; pairing, physical-device transport, recovery, and relay costs remain unproven.

Before broadening beyond self-hosters, confirm whether the standing goal of no developer-funded infrastructure still applies. Free public relays do not establish unlimited capacity or eliminate operating dependencies. A static landing page, privacy policy, support contact, and demo do not require hosting the dashboard.

**User-owned hosting** cuts setup friction without developer-funded infrastructure, and should be tried before the server-free rewrite:

- **Docker image + compose file** — baseline for every other route.
- **Home-server app stores** — Umbrel, CasaOS, YunoHost, Home Assistant add-on. Each is a near one-click install and a discovery channel aimed at the target buyer.
- **Bring-your-own managed PocketBase** (e.g. PocketHost) — the household signs up and owns the account; a guide or script uploads migrations + hooks. Gives an HTTPS URL reachable off-LAN with no Tailscale. Verify the provider supports custom JS hooks and its current terms before recommending it.

## Public-build blockers (code review 2026-11-24)

Must be resolved before any stranger installs the app:

- **Backend URL is compiled in.** `EXPO_PUBLIC_POCKETBASE_URL` is read at build time in [client.ts](../../apps/mobile/lib/client.ts) and in [app.config.js](../../apps/mobile/app.config.js) (expo-updates manifest URL). A public APK needs runtime server entry — QR pairing from the parent device is the natural fit. The OTA update URL must also become per-household or switch to a developer-neutral channel; check expo-updates' runtime URL override support for the pinned SDK.
- **Plaintext HTTP.** Current deployments are LAN `http://`. Off-LAN households would send passwords and child data unencrypted. Public builds should require HTTPS (or a private mesh like Tailscale) except for explicit LAN-only setups.
- **In-app APK updater vs. Play policy.** Play forbids apps updating themselves outside Play and restricts `REQUEST_INSTALL_PACKAGES` (currently declared via [withUnifiedPush.js](../../apps/mobile/plugins/withUnifiedPush.js)). Recheck the current policy text, but plan on two build flavors: `public-sideload` (no Family Link, keeps updater) and `public-play` (no Family Link, no updater/permission). An EAS build profile + env flags is enough.
- **Family Link removal** must be enforced in the backend and binary, not just hidden in the UI (see Framing).

## Rollout phases

1. **Phase 0 — prep (no public launch):** clear the [public-build blockers](#public-build-blockers-code-review-2026-11-24); Docker image + setup guide (Pi / VPS / old laptop); demo video (chore → approve → balance → kid spends on screen time).
2. **Phase 1 — free sideload trial:** GitHub Releases, no payment yet. Watch setup success, retention, and especially *setup complaints*. Submit Umbrel/CasaOS listings once setup is stable. Optimize for feedback, not revenue.
3. **Phase 1b — Play Store (if signal):** paid-upfront listing with Family Library enabled (or free + IAP if conversion data argues for it); the trial cohort covers the 12-tester / 14-day gate.
4. **Phase 2 — hosted tier (if real signal):** self-host free / hosted $3–5 mo; evaluate managed sync, backups, and notification delivery as paid service value; do not assume iOS requires a PayDirt-hosted relay before testing delivery options.
5. **Phase 3 — iOS:** Audit the Expo build and Android-specific UnifiedPush plugin, then validate iOS notification delivery (including APNs), background behavior, purchases, pairing, and recovery on devices. Existing iOS configuration does not prove readiness; an inbox-only first release is an option. Family Link being off removes the biggest parity blocker. StoreKit handles billing.
   - **Parent app first.** The likely mixed household is a parent on iPhone with kids on Android or tablets; a parent-only iOS build may capture most of the demand.
   - **Push:** a self-hosted backend can't hold the developer's APNs key. Expo's push service (credentials held by EAS; the household server just POSTs a token + message) avoids running a relay. Use it on iOS only; Android stays on ntfy/UnifiedPush. Recheck Expo push terms/limits.
   - **No iOS sideload** outside the EU — TestFlight external testing is the trial vehicle.

### Pilot gates

Recruit 15–25 Android households outside the developer's immediate circle. The self-hosted cohort tests niche demand; ordinary parents who cannot troubleshoot servers test a different onboarding proposition. Do not treat one cohort as representative of the other.

- Validate setup, assignment, completion, approval, earning, and redemption without developer assistance.
- Observe four weeks of use: setup success, weekly active households, completed approval cycles, support minutes per household, and reasons for abandonment.
- Test real payment with a small cohort before treating interest, stars, or downloads as evidence of willingness to pay.
- Set numeric continuation thresholds before recruitment. Expand only after retention, payment, and support effort justify it; defer paid advertising until then.
- For personal Google Play accounts created after November 13, 2023, current production-access requirements include at least 12 testers opted in continuously for 14 days. This is a distribution gate, not demand validation. Recheck [Google's testing requirements](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en-419) before launch.

## Marketing (GitHub is the hub — no web app initially)

- **Niche first:** Show HN, r/selfhosted, r/privacy, GrapheneOS/LineageOS forums — exact buyer, already sideloads and runs servers.
- **Parents second:** r/daddit / r/parenting with a different pitch — "chores → real allowance → screen time," lead with the money system, not the tech.
- **Video beats copy:** one 60–90s demo is the conversion asset; show the real setup effort; do not imply a ten-minute setup until users demonstrate it.
- **Play phase:** family-tech YouTube/TikTok reviewers; "degoogled kid phone" is a hookable story.
- Lead the parent-facing pitch with the outcome: kids know what to do, parents approve completion, and rewards stay clear. Use the household origin story and a complete workflow recording.
- Recruit through community-approved posts, referrals, homeschool groups, and small parenting creators. Track acquisition sources separately; privacy enthusiasts are not a proxy for all parents.
- Track recruits excluded because a parent has an iPhone; mixed-device demand should inform iOS timing.
- Every funnel ends at "install, then set up a server" — setup friction is the activation metric to watch.

## Risks / open questions

- Backend setup is the activation barrier; if complaints cluster there, the trial is really testing *setup UX*, not demand. Prebuilt Pi image as paid-tier bonus is the likely fix.
- Kids + payments: keep everything virtual (parentBucks). Real-money payouts (Phase 4 Venmo/Wallet ideas) bring money-transmitter/KYC problems — out of scope for any trial.
- Document children's data flows before recruiting: photos, messages, identifiers, notification payloads, logs, and any relay traffic. Self-hosting does not establish that all data stays on the household server; audit each integration. Parent-created accounts do not automatically remove COPPA obligations. Determine applicable consent, deletion, retention, and security requirements. See [FTC COPPA guidance](https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions).
- Review Google Play target-audience/Families requirements and Apple's category rules before submission. Apple Kids Category purchases and external links require parental gates; a gate is not equivalent to legal parental consent. See [Apple review guidelines](https://developer.apple.com/app-store/review/guidelines/).
- Apple Developer membership is currently $99/year; enrollment/account access remains a prerequisite. Future automatic iPhone screen-time control would need a separate feasibility assessment using Screen Time frameworks and the Family Controls distribution entitlement. It is not included in the chore-app release. See [membership](https://developer.apple.com/help/account/membership/program-enrollment/) and [entitlement requirements](https://developer.apple.com/documentation/familycontrols/requesting-the-family-controls-entitlement). Recheck fees and policies before launch.
- **Proposed rule: the developer never receives household or child data** — no telemetry, analytics, or third-party crash reporting in public builds (none are present today). It is the strongest marketing line and keeps the developer's own data handling minimal; it does not by itself settle COPPA questions. Sell through a merchant of record (Play, Paddle, Lemon Squeezy) so sales tax/VAT is handled.
- **License undecided:** AGPL vs. source-available (FSL/BUSL). Under any open license a fork can republish on Play; decide whether that matters before publishing the repo as the product.
- **v1 audience undecided:** self-hosters only, or parents via bring-your-own managed PocketBase. This determines whether the setup guide or Docker/app-store packaging comes first.
- Price point and founder-price duration undecided; pick at Phase 1b.
- Do we ever list on F-Droid (free only, no paid)? Good niche reach; decide whether paid unlock lives outside the store.

## Not doing yet

No code changes, no store accounts, no pricing commits. This document records the discussion and a preferred direction (FL off, free sideload trial, then paid Play build or one-time unlock) so execution can start from a single place when wanted. The server-free spike stays parked until this trial shows demand.
