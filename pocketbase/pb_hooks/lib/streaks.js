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
function localDay(value) {
  const date = value instanceof Date ? value : new Date(value.replace(" ", "T"));
  return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
}

// Pure: counts consecutive server-local days, ending `now`, present in `days` (a
// map of YYYY-MM-DD → true). See packages/shared/src/streaks.ts#computeStreak.
//
// Grace period: today isn't over yet, so a streak whose last earn was
// yesterday is still alive. Without this, the 3am daily cron would zero
// every streak before the kids wake up.
function computeStreakFromDays(now, days) {
  const cursor = new Date(now.getTime());
  if (!days[localDay(cursor)]) {
    cursor.setDate(cursor.getDate() - 1);
  }
  let streak = 0;
  while (days[localDay(cursor)]) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

// Count consecutive days, ending today (server-local), on which the child earned from
// a chore (Grit earns, held-minute earns, or legacy chore grants).
function computeStreak(app, childId) {
  const calendar = require(__hooks + "/lib/calendar.js");
  const child = app.findRecordById("users", childId);
  const household = app.findRecordById("households", child.getString("household"));
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
    days[calendar.day(household, new Date(t.getString("created").replace(" ", "T")))] = true;
  }
  // Count approval-day earnings, never later redemptions or standalone bonuses.
  const earned = app.findRecordsByFilter("time_ledger", "child = {:c} && kind = 'earn'", "-created", 200, 0, { c: childId });
  for (const row of earned) {
    days[calendar.day(household, new Date(row.getString("created").replace(" ", "T")))] = true;
  }
  const grants = app.findRecordsByFilter("time_grants", "child = {:c} && assignment != '' && redemption = ''", "-created", 200, 0, { c: childId });
  for (const g of grants) {
    days[calendar.day(household, new Date(g.getString("created").replace(" ", "T")))] = true;
  }
  return computeStreakFromDays(calendar.wall(household, new Date()), days);
}

// Pure: the bonus to grant when a streak refresh crosses a milestone, or
// undefined when nothing should fire. `milestones` is the already
// override-resolved day → bonus map (per-household overrides are a
// PocketBase record lookup and stay in lib/balanceReactions.js). See
// packages/shared/src/streaks.ts#getMilestoneBonus.
function getMilestoneBonus(streak, prevStreak, milestones) {
  if (streak <= prevStreak) return undefined;
  return milestones[streak] || undefined;
}

module.exports = { STREAK_MILESTONES, computeStreak, computeStreakFromDays, getMilestoneBonus };
