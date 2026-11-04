// Cron job bodies. NOT auto-loaded; require()'d by scheduler.pb.js handlers.
// All times are server-local for the HH:MM comparisons and UTC for date
// arithmetic; dedupe markers are stored on the records themselves so a
// 10-minute tick can't double-send.
//
// The fire/no-fire decision helpers below mirror
// packages/shared/src/scheduling.ts, which is the tested source of truth
// (vitest + a fake clock). PocketBase's embedded Goja runtime can't import
// that package — require() here only resolves local .js files, no
// node_modules/TS/ESM support — so this is a hand-ported, behavior-identical
// mirror. Keep the two in sync if the fire/no-fire rules ever change.

const HOUR_MS = 3600e3;
const DAY_MS = 86400e3;

function pbDate(d) {
  return d.toISOString().replace("T", " ");
}

function listHouseholds(app) {
  return app.findRecordsByFilter("households", "id != ''", "", 0, 0, {});
}

// ── pure fire/no-fire decisions (mirrors packages/shared/src/scheduling.ts) ──

function shouldFireNudge(now, completedAt, nudgedAt, nudgeHours, vacationMode) {
  if (vacationMode || nudgeHours <= 0) return false;
  const cutoff = now.getTime() - nudgeHours * HOUR_MS;
  if (completedAt.getTime() > cutoff) return false;
  if (nudgedAt && nudgedAt.getTime() >= completedAt.getTime()) return false;
  return true;
}

function shouldFireReminder(now, reminderTime, lastRemindedAt, vacationMode) {
  if (vacationMode) return false;
  const pad = (n) => String(n).padStart(2, "0");
  const nowHM = pad(now.getHours()) + ":" + pad(now.getMinutes());
  if (nowHM < reminderTime) return false;
  if (lastRemindedAt) {
    const today = now.toISOString().slice(0, 10);
    const lastRemindedDay = lastRemindedAt.toISOString().slice(0, 10);
    if (lastRemindedDay === today) return false;
  }
  return true;
}

function computeDueStage(now, dueAt) {
  const msLeft = dueAt.getTime() - now.getTime();
  if (msLeft <= 0) return 3;
  if (msLeft <= 2 * HOUR_MS) return 2;
  if (msLeft <= 24 * HOUR_MS) return 1;
  return 0;
}

function shouldEscalate(stage, prevStage, vacationMode) {
  if (vacationMode) return false;
  return stage > 0 && stage > prevStage;
}

function isCurrencyExpired(now, createdAt, expiryDays, vacationMode) {
  if (vacationMode || expiryDays <= 0) return false;
  const cutoff = now.getTime() - expiryDays * DAY_MS;
  return createdAt.getTime() <= cutoff;
}

// Reason prefix on the compensating row runDaily writes; those rows are lapses, not spends.
const EXPIRED_REASON_PREFIX = "Expired rewards";

// What the expiry cron should do for one kid (mirrors expiryLapse in
// packages/shared/src/scheduling.ts, which holds the tested spec). Replays the
// ledger oldest-first: each `earn` row is a lot and every debit consumes the
// oldest lots first, so spent grit can't expire twice and a fresh earn is never
// charged for an old one. Non-earn credits never expire. rows: [{id, type,
// amount, created: Date, reason, expiry_processed}].
function expiryLapse(rows, now, expiryDays, balance) {
  if (expiryDays <= 0) return { lapse: 0, staleIds: [] };
  const span = expiryDays * DAY_MS;
  const sorted = rows.slice().sort((a, b) => a.created.getTime() - b.created.getTime());
  const lots = [];
  for (const r of sorted) {
    if (r.type === "earn" && r.amount > 0) {
      lots.push({ row: r, left: r.amount });
      continue;
    }
    if (r.amount >= 0 || (r.reason || "").indexOf(EXPIRED_REASON_PREFIX) === 0) continue;
    let debit = -r.amount;
    for (const lot of lots) {
      if (debit <= 0) break;
      const gone = lot.row.expiry_processed && lot.row.created.getTime() + span <= r.created.getTime();
      if (gone || lot.left <= 0) continue;
      const take = Math.min(lot.left, debit);
      lot.left -= take;
      debit -= take;
    }
  }
  const stale = lots.filter((l) => !l.row.expiry_processed && l.row.created.getTime() + span <= now.getTime());
  let left = 0;
  for (const l of stale) left += l.left;
  return { lapse: Math.max(0, Math.min(left, balance)), staleIds: stale.map((l) => l.row.id) };
}

function shouldSendWeeklyDigest(vacationMode) {
  return !vacationMode;
}

// Kid chore summary. Mirrors scheduling.ts (localDay, digestTimeFor,
// shouldFireDigest, buildDigestMessage).
function localDay(now) {
  const pad = (n) => String(n).padStart(2, "0");
  return now.getFullYear() + "-" + pad(now.getMonth() + 1) + "-" + pad(now.getDate());
}

function digestTimeFor(now, weekday, weekend) {
  const d = now.getDay();
  return d === 0 || d === 6 ? weekend : weekday;
}

function shouldFireDigest(now, time, lastSentDay, vacationMode) {
  if (vacationMode || !/^\d{2}:\d{2}$/.test(time)) return false;
  const pad = (n) => String(n).padStart(2, "0");
  const nowHM = pad(now.getHours()) + ":" + pad(now.getMinutes());
  if (nowHM < time) return false;
  return lastSentDay !== localDay(now);
}

function buildDigestMessage(names) {
  const n = names.length;
  const more = n > 3 ? " +" + (n - 3) + " more" : "";
  return n + " chore" + (n === 1 ? "" : "s") + " today: " + names.slice(0, 3).join(", ") + more;
}

// ── tick (every 10 min): nudges, scheduled reminders, deadlines, kid alarms ──
function runTick(app) {
  const { notifyUser, notifyParents } = require(`${__hooks}/lib/ntfy.js`);
  const now = new Date();
  const nowStr = pbDate(now);

  for (const hh of listHouseholds(app)) {
    if (hh.getBool("paused")) continue;

    // Approval nudges: a completed chore has sat unapproved for > nudge_hours.
    // One nudge per completion (nudged_at < completed_at handles resubmits).
    const nudgeHours = hh.getFloat("nudge_hours");
    if (nudgeHours > 0) {
      const cutoff = pbDate(new Date(now.getTime() - nudgeHours * HOUR_MS));
      const waiting = app.findRecordsByFilter(
        "assignments",
        "status = 'completed' && completed_at != '' && completed_at <= {:cutoff} && chore.household = {:hh}",
        "",
        0,
        0,
        { cutoff: cutoff, hh: hh.id },
      );
      for (const a of waiting) {
        const completedAt = new Date(a.getString("completed_at").replace(" ", "T"));
        const nudgedAtStr = a.getString("nudged_at");
        const nudgedAt = nudgedAtStr ? new Date(nudgedAtStr.replace(" ", "T")) : null;
        // vacationMode is always false here — the household-level `paused`
        // check above already skipped this iteration otherwise.
        if (!shouldFireNudge(now, completedAt, nudgedAt, nudgeHours, false)) continue;
        const chore = app.findRecordById("chores", a.getString("chore"));
        const kid = app.findRecordById("users", a.getString("child"));
        notifyParents(
          app,
          hh.id,
          "Waiting for approval ⏳",
          kid.getString("display_name") + " finished '" + chore.getString("name") + "' a while ago",
        );
        a.set("nudged_at", nowStr);
        app.save(a);
      }
    }

    // Parent-scheduled chore reminders ("HH:MM", server-local): once per day
    // per assignment, fired on the first tick at/after the set time. The
    // chore-level nowHM check is a query-avoidance guard; shouldFireReminder
    // is the authoritative decision (also re-checks nowHM).
    const pad = (n) => String(n).padStart(2, "0");
    const nowHM = pad(now.getHours()) + ":" + pad(now.getMinutes());
    const remindChores = app.findRecordsByFilter(
      "chores",
      "household = {:hh} && active = true && reminder_time != ''",
      "",
      0,
      0,
      { hh: hh.id },
    );
    for (const chore of remindChores) {
      const reminderTime = chore.getString("reminder_time");
      if (nowHM < reminderTime) continue;
      const open = app.findRecordsByFilter(
        "assignments",
        "chore = {:c} && status = 'assigned'",
        "",
        0,
        0,
        { c: chore.id },
      );
      for (const a of open) {
        const lastRemindedStr = a.getString("last_reminded");
        const lastRemindedAt = lastRemindedStr ? new Date(lastRemindedStr.replace(" ", "T")) : null;
        if (!shouldFireReminder(now, reminderTime, lastRemindedAt, false)) continue;
        notifyUser(app, a.getString("child"), "Chore time! 🧹", chore.getString("name"));
        a.set("last_reminded", nowStr);
        app.save(a);
      }
    }

    // Deadlines with escalating reminders: stage 1 = within 24h,
    // 2 = within 2h, 3 = overdue (parents get pinged on overdue too).
    const dueChores = app.findRecordsByFilter(
      "chores",
      "household = {:hh} && active = true",
      "",
      0,
      0,
      { hh: hh.id },
    );
    for (const chore of dueChores) {
      const open = app.findRecordsByFilter(
        "assignments",
        "chore = {:c} && status = 'assigned'",
        "",
        0,
        0,
        { c: chore.id },
      );
      for (const a of open) {
        const deadline = a.getString("due_at") || chore.getString("due_at");
        if (!deadline) continue;
        const stage = computeDueStage(now, new Date(deadline.replace(" ", "T")));
        if (stage === 0) continue;
        const prevStage = a.getFloat("reminder_stage");
        if (!shouldEscalate(stage, prevStage, false)) continue;
        const name = chore.getString("name");
        if (stage === 1) {
          notifyUser(app, a.getString("child"), "Due soon ⏰", name + " is due within a day");
        } else if (stage === 2) {
          notifyUser(app, a.getString("child"), "Almost due! ⏰", name + " is due in less than 2 hours");
        } else {
          notifyUser(app, a.getString("child"), "Overdue! 🚨", name + " is past due — do it now!");
          const kid = app.findRecordById("users", a.getString("child"));
          notifyParents(app, hh.id, "Chore overdue", kid.getString("display_name") + ": " + name);
        }
        a.set("reminder_stage", stage);
        app.save(a);
      }
    }

    // Per-kid "chores for today" summary at the kid's own weekday/weekend
    // time. Marked sent even with nothing open, so a late one-off doesn't
    // trigger a stray evening push. (Paused households were skipped above.)
    const kidsForDigest = app.findRecordsByFilter(
      "users",
      "household = {:hh} && role = 'child'",
      "",
      0,
      0,
      { hh: hh.id },
    );
    for (const kid of kidsForDigest) {
      const time = digestTimeFor(now, kid.getString("digest_weekday"), kid.getString("digest_weekend"));
      if (!shouldFireDigest(now, time, kid.getString("digest_sent"), false)) continue;
      const open = app.findRecordsByFilter(
        "assignments",
        "child = {:kid} && (status = 'assigned' || status = 'rejected')",
        "",
        0,
        0,
        { kid: kid.id },
      );
      if (open.length > 0) {
        const names = open.map((a) => app.findRecordById("chores", a.getString("chore")).getString("name"));
        notifyUser(app, kid.id, "Chores today 🧹", buildDigestMessage(names));
      }
      kid.set("digest_sent", localDay(now));
      app.save(kid);
    }

    // Kid-set one-shot reminders.
    const alarms = app.findRecordsByFilter(
      "assignments",
      "kid_reminder_at != '' && kid_reminder_at <= {:now} && status = 'assigned' && chore.household = {:hh}",
      "",
      0,
      0,
      { now: nowStr, hh: hh.id },
    );
    for (const a of alarms) {
      const chore = app.findRecordById("chores", a.getString("chore"));
      notifyUser(app, a.getString("child"), "Your reminder ⏰", chore.getString("name"));
      a.set("kid_reminder_at", "");
      app.save(a);
    }
  }
}

// ── daily (3am): recurring assignment, currency expiry, streak refresh ───────
function runDaily(app) {
  const { computeStreak } = require(`${__hooks}/lib/streaks.js`);
  const now = new Date();

  // Inbox items are only a convenience history; keep 30 days.
  const cutoff = new Date(now.getTime() - 30 * 24 * 3600 * 1000).toISOString().replace("T", " ");
  for (const old of app.findRecordsByFilter("inbox", "created < {:cutoff}", "", 0, 0, { cutoff: cutoff })) {
    app.delete(old);
  }

  for (const hh of listHouseholds(app)) {
    if (!hh.getBool("paused")) {
      // Recurring chore auto-assignment: re-create an assignment when a
      // recurring chore has no open assignment for a kid who's done it before.
      // "daily" cadence: re-assign any time there's no active assignment.
      // "weekly" cadence: re-assign only after 7 days since the last was created.
      const recurringChores = app.findRecordsByFilter(
        "chores",
        "household = {:hh} && active = true && type = 'recurring'",
        "",
        0,
        0,
        { hh: hh.id },
      );
      for (const chore of recurringChores) {
        const cadence = chore.getString("cadence") || "daily";
        // Build a map of childId → most recent assignment for this chore.
        const history = app.findRecordsByFilter(
          "assignments",
          "chore = {:c}",
          "-created",
          0,
          0,
          { c: chore.id },
        );
        const lastByChild = {};
        for (const a of history) {
          const cid = a.getString("child");
          if (!lastByChild[cid]) lastByChild[cid] = a;
        }
        const limit = chore.getInt("max_per_period");
        const limitDays = cadence === "weekly" ? 7 : cadence === "monthly" ? 30 : 1;
        const limitCutoff = new Date(now.getTime() - limitDays * 86400e3);
        for (const childId in lastByChild) {
          // Skip if the kid already has an open assignment for this chore.
          const open = app.findRecordsByFilter(
            "assignments",
            "chore = {:c} && child = {:kid} && status != 'approved' && status != 'closed'",
            "",
            1,
            0,
            { c: chore.id, kid: childId },
          );
          if (open.length > 0) continue;
          // Automatic recurrence follows the chore's repeat limit. Parents can
          // still deliberately override it through the assignment flow.
          if (limit > 0 && history.filter((a) =>
            a.getString("child") === childId &&
            a.getString("status") !== "closed" &&
            new Date(a.getString("created").replace(" ", "T")) >= limitCutoff,
          ).length >= limit) continue;
          // Weekly/monthly cadence: only re-assign after that many days since
          // the last was created. Daily (or anything else) re-assigns as soon
          // as there's no open assignment.
          const cadenceDays = cadence === "weekly" ? 7 : cadence === "monthly" ? 30 : 0;
          const lastDeadline = lastByChild[childId].getString("due_at");
          if (chore.getString("due_time") && lastDeadline &&
              now < new Date(lastDeadline.replace(" ", "T"))) continue;
          if (cadenceDays > 0 && !chore.getString("due_time")) {
            const lastCreated = new Date(lastByChild[childId].getString("created").replace(" ", "T"));
            if ((now.getTime() - lastCreated.getTime()) < cadenceDays * 86400e3) continue;
          }
          const a = new Record(app.findCollectionByNameOrId("assignments"));
          a.set("chore", chore.id);
          a.set("child", childId);
          a.set("status", "assigned");
          // Tells notifications.pb.js to skip its per-assignment "New chore!" push.
          a.set("auto_created", true);
          app.save(a);
          // No per-chore push here: the kid's chore summary (runTick) covers it.
        }
      }
    }

    // Expiry: earn lots older than expiry_days lapse via one compensating
    // negative adjustment per kid. Spends consume the oldest lots first
    // (expiryLapse), so already-spent grit never expires and fresh earns are
    // never charged for old ones. Skipped while on vacation.
    const expiryDays = hh.getFloat("expiry_days");
    const vacationMode = hh.getBool("paused");
    if (expiryDays > 0 && !vacationMode) {
      const cutoff = pbDate(new Date(now.getTime() - expiryDays * DAY_MS));
      const stale = app.findRecordsByFilter(
        "currency_transactions",
        "type = 'earn' && expiry_processed = false && created <= {:cutoff} && user.household = {:hh}",
        "",
        0,
        0,
        { cutoff: cutoff, hh: hh.id },
      );
      const kidIds = {};
      for (const t of stale) kidIds[t.getString("user")] = true;
      for (const uid in kidIds) {
        const all = app.findRecordsByFilter("currency_transactions", "user = {:u}", "created", 0, 0, { u: uid });
        const rows = all.map((t) => ({
          id: t.id,
          type: t.getString("type"),
          amount: t.getFloat("amount"),
          created: new Date(t.getString("created").replace(" ", "T")),
          reason: t.getString("reason"),
          expiry_processed: t.getBool("expiry_processed"),
        }));
        const child = app.findRecordById("users", uid);
        const res = expiryLapse(rows, now, expiryDays, child.getFloat("balance"));
        for (const id of res.staleIds) {
          const t = app.findRecordById("currency_transactions", id);
          t.set("expiry_processed", true);
          app.save(t);
        }
        if (res.lapse <= 0) continue;
        const tx = new Record(app.findCollectionByNameOrId("currency_transactions"));
        tx.set("user", uid);
        tx.set("amount", -res.lapse);
        tx.set("type", "manual_adjustment");
        tx.set("reason", EXPIRED_REASON_PREFIX + " (older than " + expiryDays + " days)");
        app.save(tx);
      }
    }
  }

  // Streak refresh: zero out streaks that broke (no earn yesterday or today).
  const kids = app.findRecordsByFilter("users", "role = 'child'", "", 0, 0, {});
  for (const kid of kids) {
    const streak = computeStreak(app, kid.id);
    if (streak !== kid.getFloat("streak_count")) {
      kid.set("streak_count", streak);
      app.save(kid);
    }
  }
}

// ── weekly (Sunday 6pm): digest to parents ───────────────────────────────────
function runWeeklyDigest(app) {
  const { notifyParents } = require(`${__hooks}/lib/ntfy.js`);
  const weekAgo = pbDate(new Date(Date.now() - 7 * 86400e3));

  for (const hh of listHouseholds(app)) {
    if (!shouldSendWeeklyDigest(hh.getBool("paused"))) continue;
    const currency = hh.getString("currency_name") || "Grit";
    const kids = app.findRecordsByFilter(
      "users",
      "household = {:hh} && role = 'child'",
      "display_name",
      0,
      0,
      { hh: hh.id },
    );
    if (kids.length === 0) continue;

    const lines = [];
    for (const kid of kids) {
      const txs = app.findRecordsByFilter(
        "currency_transactions",
        "user = {:u} && created >= {:since}",
        "",
        0,
        0,
        { u: kid.id, since: weekAgo },
      );
      let earned = 0;
      let spent = 0;
      for (const t of txs) {
        const amt = t.getFloat("amount");
        if (amt > 0) earned += amt;
        else spent -= amt;
      }
      const done = app.findRecordsByFilter(
        "assignments",
        "child = {:u} && status = 'approved' && approved_at >= {:since}",
        "",
        0,
        0,
        { u: kid.id, since: weekAgo },
      );
      lines.push(
        kid.getString("display_name") + ": " + done.length + " chores, +" + earned +
          "/-" + spent + " " + currency + ", balance " + kid.getFloat("balance"),
      );
    }
    const pending = app.findRecordsByFilter(
      "assignments",
      "status = 'completed' && chore.household = {:hh}",
      "",
      0,
      0,
      { hh: hh.id },
    );
    if (pending.length > 0) {
      lines.push(pending.length + " completion(s) still waiting for approval");
    }
    notifyParents(app, hh.id, "PayDirt weekly digest 📊", lines.join("\n"));
  }
}

function runKidWeeklyRecap(app) {
  const { notifyUser } = require(`${__hooks}/lib/ntfy.js`);
  const weekAgo = pbDate(new Date(Date.now() - 7 * 86400e3));

  for (const hh of listHouseholds(app)) {
    if (hh.getBool("paused")) continue;
    const currency = hh.getString("currency_name") || "Grit";
    const kids = app.findRecordsByFilter(
      "users",
      "household = {:hh} && role = 'child'",
      "display_name",
      0,
      0,
      { hh: hh.id },
    );
    for (const kid of kids) {
      const txs = app.findRecordsByFilter(
        "currency_transactions",
        "user = {:u} && created >= {:since}",
        "",
        0,
        0,
        { u: kid.id, since: weekAgo },
      );
      let earned = 0;
      for (const t of txs) {
        const amt = t.getFloat("amount");
        if (amt > 0) earned += amt;
      }
      const done = app.findRecordsByFilter(
        "assignments",
        "child = {:u} && status = 'approved' && approved_at >= {:since}",
        "",
        0,
        0,
        { u: kid.id, since: weekAgo },
      );
      // Nearest unachieved goal.
      const goals = app.findRecordsByFilter(
        "savings_goals",
        "child = {:u} && achieved = false",
        "target",
        0,
        0,
        { u: kid.id },
      );
      let goalLine = "";
      if (goals.length > 0) {
        const g = goals[0];
        const target = g.getFloat("target");
        const bal = kid.getFloat("balance");
        const pct = target > 0 ? Math.min(100, Math.round((bal / target) * 100)) : 0;
        goalLine = "\nGoal '" + g.getString("name") + "': " + pct + "% (" + bal + "/" + target + ")";
      }
      const title = "Your week 🌟";
      const msg = "You earned " + earned + " " + currency + " and completed " + done.length +
        " chore" + (done.length === 1 ? "" : "s") + "!" + goalLine;
      notifyUser(app, kid.id, title, msg);
    }
  }
}

function runScheduledAllowance(app) {
  const { notifyUser } = require(`${__hooks}/lib/ntfy.js`);
  const now = new Date();
  for (const hh of listHouseholds(app)) {
    const amount = hh.getFloat("allowance_amount");
    if (amount <= 0) continue;
    const cadence = hh.getString("allowance_cadence") || "weekly";
    const lastPaid = hh.getString("allowance_last_paid");
    const daysSince = lastPaid
      ? (now.getTime() - new Date(lastPaid).getTime()) / 86400e3
      : Infinity;
    const due = cadence === "daily" ? daysSince >= 1 : daysSince >= 7;
    if (!due) continue;

    const currency = hh.getString("currency_name") || "Grit";
    const kids = app.findRecordsByFilter(
      "users",
      "household = {:hh} && role = 'child'",
      "display_name",
      0,
      0,
      { hh: hh.id },
    );
    for (const kid of kids) {
      const tx = new Record(app.findCollectionByNameOrId("currency_transactions"));
      tx.set("user", kid.id);
      tx.set("amount", amount);
      tx.set("type", "manual_adjustment");
      tx.set("reason", "Scheduled allowance (" + cadence + ") 💵");
      app.save(tx);
      notifyUser(app, kid.id, "Payday! 💵", "+" + amount + " " + currency + " allowance");
    }
    hh.set("allowance_last_paid", now.toISOString().replace("T", " "));
    app.save(hh);
  }
}

module.exports = { runTick, runDaily, runWeeklyDigest, runKidWeeklyRecap, runScheduledAllowance };
