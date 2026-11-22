// Read both sides from one consistent database snapshot.
// Read-only accounting: notifications are the only writes this check makes.
function runLedgerAudit(app) {
  const mismatches = [];
  app.runInTransaction((tx) => {
    const users = tx.findAllRecords("users");
    const totals = {};
    for (const row of tx.findAllRecords("currency_transactions")) {
      const id = row.getString("user");
      totals[id] = (totals[id] || 0) + row.getFloat("amount");
    }
    for (const user of users) {
      const cached = user.getFloat("balance");
      const computed = totals[user.id] || 0;
      const delta = cached - computed;
      if (Math.abs(delta) > 1e-9) mismatches.push({
        household: user.getString("household"), name: user.getString("display_name"),
        cached, computed, delta,
      });
    }
  });
  const households = {};
  for (const mismatch of mismatches) {
    if (!households[mismatch.household]) households[mismatch.household] = [];
    households[mismatch.household].push(mismatch.name + ": cached " + mismatch.cached +
      ", ledger " + mismatch.computed + ", difference " + mismatch.delta + " Grit.");
  }
  const { notifyParents } = require(__hooks + "/lib/ntfy.js");
  for (const household of Object.keys(households)) {
    notifyParents(app, household, "PayDirt balance needs review", households[household].join("\n") +
      "\nNo balances were changed. Review the ledger before correcting anything.", "ledger_drift");
  }
  return mismatches.length;
}
module.exports = { runLedgerAudit };
