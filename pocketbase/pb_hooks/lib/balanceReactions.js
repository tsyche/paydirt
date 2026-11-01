// Balance-driven reactions to a new ledger entry: savings goals, bank-threshold
// prompts, and streak bonuses. NOT auto-loaded (filename isn't *.pb.js);
// currency.pb.js calls runBalanceReactions() right after it updates the cached
// balance. Calling it from there (instead of a separate hook file) is what
// guarantees the balance is current: PocketBase gave no stable order between
// two hook files, and a stale read silently skipped goal/threshold/streak checks.

function runBalanceReactions(app, record) {
  const { notifyUser, notifyParents } = require(`${__hooks}/lib/ntfy.js`);
  const amount = record.getFloat("amount");
  const child = app.findRecordById("users", record.getString("user"));
  if (child.getString("role") !== "child") return;
  const balance = child.getFloat("balance"); // already updated by currency.pb.js
  const prevBalance = balance - amount;
  const household = app.findRecordById("households", child.getString("household"));
  const currency = household.getString("currency_name") || "Grit";

  // ── savings goals: mark achieved + celebrate when the target is crossed ────
  if (amount > 0) {
    const goals = app
      .findRecordsByFilter("savings_goals", "child = {:c} && achieved = false", "", 0, 0, { c: child.id })
      .filter((g) => g.getFloat("target") <= balance);
    for (const g of goals) {
      g.set("achieved", true);
      g.set("achieved_at", new Date().toISOString());
      app.save(g);
      notifyUser(app, child.id, "Goal reached! 🎯", g.getString("name"));
      notifyParents(
        app,
        household.id,
        "Savings goal reached",
        child.getString("display_name") + " hit their goal: " + g.getString("name"),
      );
    }

    // Auto-save: notify kid of the slice allocated to goals with a percent set.
    const autoGoals = app.findRecordsByFilter(
      "savings_goals",
      "child = {:c} && achieved = false && auto_save_percent > 0",
      "",
      0,
      0,
      { c: child.id },
    );
    for (const g of autoGoals) {
      const pct = g.getFloat("auto_save_percent");
      const slice = Math.round(amount * pct / 100 * 100) / 100;
      if (slice > 0) {
        notifyUser(
          app,
          child.id,
          "Auto-saved to " + g.getString("name") + " 🐷",
          slice + " " + currency + " (" + pct + "%) set aside this earn.",
        );
      }
    }
  }

  // ── bank threshold: one nudge when the balance crosses it upward ───────────
  const threshold = household.getFloat("bank_threshold");
  if (threshold > 0 && prevBalance < threshold && balance >= threshold) {
    notifyUser(
      app,
      child.id,
      "You hit " + threshold + " " + currency + "! 💰",
      "Time to treat yourself — ask to spend it!",
    );
  }

  // ── streak bonuses: only chore earnings count toward streaks ───────────────
  if (record.getString("type") === "earn") refreshStreak(app, child, household);
}

// Recompute the kid's streak and grant any milestone bonus. Called after an
// earn row, and directly for chores paid only in screen time (no earn row).
function refreshStreak(app, child, household) {
  const { notifyUser } = require(`${__hooks}/lib/ntfy.js`);
  const { STREAK_MILESTONES, computeStreak, getMilestoneBonus } = require(`${__hooks}/lib/streaks.js`);
  const currency = household.getString("currency_name") || "Grit";
  const streak = computeStreak(app, child.id);
  const prevStreak = child.getFloat("streak_count");
  if (streak !== prevStreak) {
    child.set("streak_count", streak);
    app.save(child);
  }
  // Per-household overrides; fall back to hardcoded defaults when 0/unset.
  const milestones = {};
  for (const [days, def] of Object.entries(STREAK_MILESTONES)) {
    const override = household.getFloat(`streak_bonus_${days}`);
    milestones[days] = override > 0 ? override : def;
  }
  const bonus = getMilestoneBonus(streak, prevStreak, milestones);
  if (bonus) {
    const tx = new Record(app.findCollectionByNameOrId("currency_transactions"));
    tx.set("user", child.id);
    tx.set("amount", bonus);
    tx.set("type", "manual_adjustment");
    tx.set("reason", "Streak bonus: " + streak + " days in a row! 🔥");
    app.save(tx);
    notifyUser(
      app,
      child.id,
      streak + "-day streak! 🔥",
      "+" + bonus + " " + currency + " bonus — keep it going!",
    );
  }
}

module.exports = { runBalanceReactions, refreshStreak };
