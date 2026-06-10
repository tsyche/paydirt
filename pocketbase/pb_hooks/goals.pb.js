/// <reference path="../pb_data/types.d.ts" />

// Balance-driven reactions to ledger entries: savings goals, bank-threshold
// prompts, and streak bonuses.
//
// ORDER DEPENDENCY: PocketBase loads hook files alphabetically and runs
// handlers in registration order, so currency.pb.js (which maintains the
// cached balance) runs before this file's handlers. Don't rename either file
// in a way that flips that order.

onRecordAfterCreateSuccess((e) => {
  const { notifyUser, notifyParents } = require(`${__hooks}/lib/ntfy.js`);
  const { STREAK_MILESTONES, computeStreak } = require(`${__hooks}/lib/streaks.js`);
  const amount = e.record.getFloat("amount");
  const child = e.app.findRecordById("users", e.record.getString("user"));
  if (child.getString("role") !== "child") {
    e.next();
    return;
  }
  const balance = child.getFloat("balance"); // already updated by currency.pb.js
  const prevBalance = balance - amount;
  const household = e.app.findRecordById("households", child.getString("household"));
  const currency = household.getString("currency_name") || "parentBucks";

  // ── savings goals: mark achieved + celebrate when the target is crossed ────
  if (amount > 0) {
    const goals = e.app.findRecordsByFilter(
      "savings_goals",
      "child = {:c} && achieved = false && target <= {:b}",
      "",
      0,
      0,
      { c: child.id, b: balance },
    );
    for (const g of goals) {
      g.set("achieved", true);
      g.set("achieved_at", new Date().toISOString());
      e.app.save(g);
      notifyUser(e.app, child.id, "Goal reached! 🎯", g.getString("name"));
      notifyParents(
        e.app,
        household.id,
        "Savings goal reached",
        child.getString("display_name") + " hit their goal: " + g.getString("name"),
      );
    }
  }

  // ── bank threshold: one nudge when the balance crosses it upward ───────────
  const threshold = household.getFloat("bank_threshold");
  if (threshold > 0 && prevBalance < threshold && balance >= threshold) {
    notifyUser(
      e.app,
      child.id,
      "You hit " + threshold + " " + currency + "! 💰",
      "Time to treat yourself — ask to spend it!",
    );
  }

  // ── streak bonuses: only chore earnings count toward streaks ───────────────
  if (e.record.getString("type") === "earn") {
    const streak = computeStreak(e.app, child.id);
    const prevStreak = child.getFloat("streak_count");
    if (streak !== prevStreak) {
      child.set("streak_count", streak);
      e.app.save(child);
    }
    const bonus = STREAK_MILESTONES[streak];
    if (bonus && streak > prevStreak) {
      const tx = new Record(e.app.findCollectionByNameOrId("currency_transactions"));
      tx.set("user", child.id);
      tx.set("amount", bonus);
      tx.set("type", "manual_adjustment");
      tx.set("reason", "Streak bonus: " + streak + " days in a row! 🔥");
      e.app.save(tx);
      notifyUser(
        e.app,
        child.id,
        streak + "-day streak! 🔥",
        "+" + bonus + " " + currency + " bonus — keep it going!",
      );
    }
  }
  e.next();
}, "currency_transactions");
