// Streak helpers. NOT auto-loaded (filename isn't *.pb.js); require() this
// from inside hook/cron handlers — PocketBase runs each handler in an
// isolated VM, so file-scope functions in a .pb.js are not visible there.
//
// computeStreakFromDays and getMilestoneBonus below mirror
// packages/shared/src/streaks.ts, which is the tested source of truth
// (vitest + a fake clock). PocketBase's embedded Goja runtime can't import
// that package — require() here only resolves local .js files, no
// node_modules/TS/ESM support — so this is a hand-ported, behavior-identical
// mirror. Keep the two in sync if the streak rules ever change.

// Milestone day-counts → bonus amount. Granted once per milestone per streak.
const STREAK_MILESTONES = { 3: 5, 7: 15, 14: 40, 30: 100 };

// Pure: counts consecutive days, ending `now` (UTC), present in `days` (a
// map of YYYY-MM-DD → true). See packages/shared/src/streaks.ts#computeStreak.
//
// Grace period: today isn't over yet, so a streak whose last earn was
// yesterday is still alive. Without this, the 3am daily cron would zero
// every streak before the kids wake up.
function computeStreakFromDays(now, days) {
  const cursor = new Date(now.getTime());
  if (!days[cursor.toISOString().slice(0, 10)]) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  let streak = 0;
  while (days[cursor.toISOString().slice(0, 10)]) {
    streak++;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

// Count consecutive days, ending today (UTC), on which the child earned from
// a chore (type = "earn" ledger entries).
function computeStreak(app, childId) {
  const txs = app.findRecordsByFilter(
    "currency_transactions",
    "user = {:c} && type = 'earn'",
    "-created",
    200,
    0,
    { c: childId },
  );
  const days = {};
  for (const t of txs) {
    days[t.getString("created").slice(0, 10)] = true;
  }
  return computeStreakFromDays(new Date(), days);
}

// Pure: the bonus to grant when a streak refresh crosses a milestone, or
// undefined when nothing should fire. `milestones` is the already
// override-resolved day → bonus map (per-household overrides are a
// PocketBase record lookup and stay in goals.pb.js). See
// packages/shared/src/streaks.ts#getMilestoneBonus.
function getMilestoneBonus(streak, prevStreak, milestones) {
  if (streak <= prevStreak) return undefined;
  return milestones[streak] || undefined;
}

module.exports = { STREAK_MILESTONES, computeStreak, computeStreakFromDays, getMilestoneBonus };
