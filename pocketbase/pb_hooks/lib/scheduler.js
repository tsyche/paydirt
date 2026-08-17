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

function shouldSendWeeklyDigest(vacationMode) {
  return !vacationMode;
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
      "household = {:hh} && active = true && due_at != ''",
      "",
      0,
      0,
      { hh: hh.id },
    );
    for (const chore of dueChores) {
      const due = new Date(chore.getString("due_at").replace(" ", "T"));
      const stage = computeDueStage(now, due);
      if (stage === 0) continue;
      const open = app.findRecordsByFilter(
        "assignments",
        "chore = {:c} && status = 'assigned'",
        "",
        0,
        0,
        { c: chore.id },
      );
      for (const a of open) {
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
  const { notifyUser } = require(`${__hooks}/lib/ntfy.js`);
  const now = new Date();

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
          // Weekly/monthly cadence: only re-assign after that many days since
          // the last was created. Daily (or anything else) re-assigns as soon
          // as there's no open assignment.
          const cadenceDays = cadence === "weekly" ? 7 : cadence === "monthly" ? 30 : 0;
          if (cadenceDays > 0) {
            const lastCreated = new Date(lastByChild[childId].getString("created").replace(" ", "T"));
            if ((now.getTime() - lastCreated.getTime()) < cadenceDays * 86400e3) continue;
          }
          const a = new Record(app.findCollectionByNameOrId("assignments"));
          a.set("chore", chore.id);
          a.set("child", childId);
          a.set("status", "assigned");
          app.save(a);
          notifyUser(app, childId, "New chore assigned 🧹", chore.getString("name"));
        }
      }
    }

    // Expiry: earn entries older than expiry_days lapse via a compensating
    // negative adjustment, capped at the current balance (already-spent
    // rewards can't expire twice). Skipped while on vacation.
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
      const byChild = {};
      for (const t of stale) {
        const createdAt = new Date(t.getString("created").replace(" ", "T"));
        if (!isCurrencyExpired(now, createdAt, expiryDays, vacationMode)) continue;
        const uid = t.getString("user");
        byChild[uid] = (byChild[uid] || 0) + t.getFloat("amount");
        t.set("expiry_processed", true);
        app.save(t);
      }
      for (const uid in byChild) {
        const child = app.findRecordById("users", uid);
        const lapse = Math.min(byChild[uid], child.getFloat("balance"));
        if (lapse <= 0) continue;
        const tx = new Record(app.findCollectionByNameOrId("currency_transactions"));
        tx.set("user", uid);
        tx.set("amount", -lapse);
        tx.set("type", "manual_adjustment");
        tx.set("reason", "Expired rewards (older than " + expiryDays + " days)");
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
    const currency = hh.getString("currency_name") || "parentBucks";
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

module.exports = { runTick, runDaily, runWeeklyDigest };
