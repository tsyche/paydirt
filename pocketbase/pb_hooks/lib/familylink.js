// PocketBase owns approval/status; the separate worker owns Google's session.
// A committed queued row is the outbox. The cron repairs a failed file publish.
function queueDir() {
  return $os.getenv("FL_QUEUE_DIR") || "/var/lib/paydirt/familylink/queue";
}

function exists(file) {
  try { $os.stat(file); return true; } catch (_) { return false; }
}

// spend_requests carry screen_minutes; time_grants (chore bonus) carry minutes.
function minutesOf(record) {
  return record.getInt("screen_minutes") || record.getInt("minutes");
}

function prepare(record, app) {
  if (!minutesOf(record)) return;
  record.set("grant_delivered_seconds", 0);
  const child = app.findRecordById("users", record.getString("child"));
  let error = "";
  if ($os.getenv("FL_AUTOMATION_ENABLED") !== "1") {
    error = "Automatic grants are disabled. Grant the time manually.";
  } else if (!child.getString("fl_child_id") || !child.getString("fl_device_id")) {
    error = "Family Link target is missing. Grant the time manually.";
  }
  record.set("grant_status", error ? "manual" : "queued");
  record.set("grant_error", error);
}

function deliveryId(record) {
  const delivered = record.getInt("grant_delivered_seconds");
  return record.id + (delivered ? "-" + delivered : "");
}

function publish(app, record, at) {
  if (record.getString("grant_status") !== "queued") return;
  // After-success hooks can retain the pre-approval original record. Reload
  // before saving queue status, or a purchase can re-enter approval side effects.
  record = app.findRecordById(record.collection().name, record.id);
  if (record.getString("grant_status") === "queued") publishReady(app, record, at);
}

function publishReady(app, record, at) {
  const dir = queueDir();
  for (const part of ["pending", "processing", "results"]) $os.mkdirAll(dir + "/" + part, 0o700);
  const name = deliveryId(record) + ".json";
  // A deferred receipt proves no time was granted. An explicit override may
  // retry it immediately, but must not touch a live claim or an uncertain result.
  if (record.getBool("grant_window_override") &&
      !exists(dir + "/pending/" + name) && !exists(dir + "/processing/" + name) &&
      exists(dir + "/results/" + name)) {
    const result = JSON.parse(toString($os.readFile(dir + "/results/" + name)));
    if (result.id === deliveryId(record) && result.status === "deferred") $os.remove(dir + "/results/" + name);
  }
  // Never publish a second copy while a worker owns this request.
  for (const part of ["pending", "processing", "results"]) {
    if (exists(dir + "/" + part + "/" + name)) return;
  }
  const child = app.findRecordById("users", record.getString("child"));
  const household = app.findRecordById("households", child.getString("household"));
  const now = at || new Date();
  const expiryDays = household.getInt("grant_expiry_days");
  const expiresAt = expiryDays ? new Date(new Date(record.getString("created").replace(" ", "T")).getTime() + expiryDays * 86400000).toISOString() : "";
  if (expiresAt && now >= new Date(expiresAt)) {
    record.set("grant_status", "manual");
    record.set("grant_error", "Queued time expired without delivery. Review the purchase or chore reward manually.");
    app.save(record); notifyManual(app, record); return;
  }
  const state = record.getBool("grant_window_override")
    ? { open: true, message: "Parent delivery override enabled.", validUntil: "" }
    : require(__hooks + "/lib/grantWindows.js").windowState(household, now, child);
  if (record.getString("grant_error") !== state.message) {
    record.set("grant_error", state.message);
    app.save(record);
  }
  if (!state.open) return;
  // Commit the permanent marker BEFORE touching the worker's filesystem.
  // The time-bank update guard serializes this write against cancellation.
  if (record.getString("redemption") && !record.getBool("grant_dispatch_started")) {
    record.set("grant_dispatch_started", true);
    app.save(record);
  }
  const job = {
    id: deliveryId(record),
    childId: child.getString("fl_child_id"),
    deviceId: child.getString("fl_device_id"),
    seconds: minutesOf(record) * 60 - record.getInt("grant_delivered_seconds"),
  };
  if (state.validUntil) job.validUntil = state.validUntil;
  if (expiresAt) job.expiresAt = expiresAt;
  const temporary = dir + "/" + name + ".tmp";
  $os.writeFile(temporary, JSON.stringify(job), 0o600);
  $os.rename(temporary, dir + "/pending/" + name);
}

function notifyManual(app, record) {
  const { notifyParents } = require(__hooks + "/lib/ntfy.js");
  const child = app.findRecordById("users", record.getString("child"));
  notifyParents(app, child.getString("household"), "Screen time needs manual review",
    child.getString("display_name") + ": " + record.getString("description") + ". " +
    record.getString("grant_error"), "grant_manual", record.collection().name + ":" + record.id + ":grant");
}

function reconcile(app, at, scope) {
  // Cron and foreground refreshes may import the same receipt concurrently.
  // Reload/query under one write transaction so every receipt advances once.
  if (app.isTransactional()) throw new Error("Reconcile receipts from the root app so publication follows commit.");
  let changed = 0;
  const pending = [];
  app.runInTransaction((tx) => { changed = reconcileQueued(tx, at, scope || {}, pending); });
  // File jobs can start immediately. Publish only after the import transaction
  // commits, preserving the dispatch marker's commit-before-publication rule.
  for (const item of pending) {
    try { publish(app, app.findRecordById(item.collection, item.id), at); }
    catch (_) { app.logger().error("Family Link publication deferred", "grant", item.id); }
  }
  return changed;
}

function reconcileQueued(app, at, scope, pending) {
  let changed = 0;
  const filter = (scope.household ? " && child.household = {:hh}" : "") + (scope.child ? " && child = {:kid}" : "");
  const params = { hh: scope.household || "", kid: scope.child || "" };
  const now = at || new Date();
  const rows = app.findRecordsByFilter("spend_requests",
    "status = 'approved' && grant_status = 'queued'" + filter, "created", 0, 0, params)
    .concat(app.findRecordsByFilter("time_grants", "grant_status = 'queued'" + filter, "created", 0, 0, params))
    .sort((a, b) => a.getString("created").localeCompare(b.getString("created")));
  for (const record of rows) {
    try {
      const file = queueDir() + "/results/" + deliveryId(record) + ".json";
      if (!exists(file)) {
        if (!scope.receiptsOnly) pending.push({ collection: record.collection().name, id: record.id });
        continue;
      }
      const result = JSON.parse(toString($os.readFile(file)));
      if (result.id !== deliveryId(record) || ["granted", "manual", "deferred"].indexOf(result.status) === -1) {
        throw new Error("Invalid grant result");
      }
      if (result.status === "deferred") {
        if (scope.receiptsOnly) continue;
        if (result.retryAfter && now < new Date(result.retryAfter) && !record.getBool("grant_window_override")) continue;
        // Worker never contacted Google. Safe to retry in the next window.
        $os.remove(file);
        pending.push({ collection: record.collection().name, id: record.id });
        continue;
      }
      const errors = {
        session_expired: "Family Link session expired. Run fl-login and fl-host-setup on the Mac, then grant manually.",
        interrupted: "The grant was interrupted and may have succeeded. Check Family Link before granting manually.",
        failed: "The grant failed and may have succeeded. Check Family Link before granting manually.",
        disabled: "Automatic grants are disabled. Grant the time manually.",
        invalid_request: "The grant target or duration is invalid. Check the child's settings and grant manually.",
        expired: "Queued time expired without delivery. Review the purchase or chore reward manually.",
      };
      let delivered = 0;
      if (result.status === "granted") {
        // Old worker receipts omit the amount: they delivered the whole request.
        const remaining = minutesOf(record) * 60 - record.getInt("grant_delivered_seconds");
        delivered = result.deliveredSeconds === undefined ? remaining : result.deliveredSeconds;
        if (!Number.isInteger(delivered) || delivered <= 0 || delivered > remaining || delivered % 60) {
          throw new Error("Invalid delivered duration");
        }
        record.set("grant_delivered_seconds", record.getInt("grant_delivered_seconds") + delivered);
      }
      const partial = result.status === "granted" && record.getInt("grant_delivered_seconds") < minutesOf(record) * 60;
      record.set("grant_status", partial ? "queued" : result.status);
      record.set("grant_error", result.status === "manual" ? errors[result.error] || errors.failed : "");
      app.save(record);
      changed++;
      if (result.status === "granted") {
        require(__hooks + "/lib/ntfy.js").notifyUser(app, record.getString("child"),
          "Screen time delivered 📱", delivered / 60 + " minutes have landed." +
          (partial ? " The rest is queued for an allowed window." : ""), "time_granted");
      }
      if (partial && !scope.receiptsOnly) pending.push({ collection: record.collection().name, id: record.id });
      // Keep the receipt on disk: a repeated publish can never replay it.
      if (result.status === "manual") notifyManual(app, record);
    } catch (_) {
      // No raw errors: authenticated browser URLs and responses may hold secrets.
      app.logger().error("Family Link queue reconciliation failed", "spend", record.id);
    }
  }
  return changed;
}

module.exports = { prepare, publish, reconcile, notifyManual };
