// Streak helpers. NOT auto-loaded (filename isn't *.pb.js); require() this
// from inside hook/cron handlers — PocketBase runs each handler in an
// isolated VM, so file-scope functions in a .pb.js are not visible there.

// Milestone day-counts → bonus amount. Granted once per milestone per streak.
const STREAK_MILESTONES = { 3: 5, 7: 15, 14: 40, 30: 100 };

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
  let streak = 0;
  const cursor = new Date();
  // Grace period: today isn't over yet, so a streak whose last earn was
  // yesterday is still alive. Without this, the 3am daily cron would zero
  // every streak before the kids wake up.
  if (!days[cursor.toISOString().slice(0, 10)]) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  while (days[cursor.toISOString().slice(0, 10)]) {
    streak++;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

module.exports = { STREAK_MILESTONES, computeStreak };
