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

function publish(app, record) {
  const dir = queueDir();
  for (const part of ["pending", "processing", "results"]) $os.mkdirAll(dir + "/" + part, 0o700);
  const name = record.id + ".json";
  // Never publish a second copy while a worker owns this request.
  for (const part of ["pending", "processing", "results"]) {
    if (exists(dir + "/" + part + "/" + name)) return;
  }
  const child = app.findRecordById("users", record.getString("child"));
  const household = app.findRecordById("households", child.getString("household"));
  const now = new Date();
  const expiryDays = household.getInt("grant_expiry_days");
  const expiresAt = expiryDays ? new Date(new Date(record.getString("created").replace(" ", "T")).getTime() + expiryDays * 86400000).toISOString() : "";
  if (expiresAt && now >= new Date(expiresAt)) {
    record.set("grant_status", "manual");
    record.set("grant_error", "Queued time expired without delivery. Review the purchase or chore reward manually.");
    app.save(record); notifyManual(app, record); return;
  }
  const state = require(__hooks + "/lib/grantWindows.js").windowState(household, now, child);
  if (record.getString("grant_error") !== state.message) {
    record.set("grant_error", state.message);
    app.save(record);
  }
  if (!state.open) return;
  const job = {
    id: record.id,
    childId: child.getString("fl_child_id"),
    deviceId: child.getString("fl_device_id"),
    seconds: minutesOf(record) * 60,
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
    record.getString("grant_error"));
}

function reconcile(app) {
  const rows = app.findRecordsByFilter("spend_requests",
    "status = 'approved' && grant_status = 'queued'", "created", 0, 0)
    .concat(app.findRecordsByFilter("time_grants", "grant_status = 'queued'", "created", 0, 0))
    .sort((a, b) => a.getString("created").localeCompare(b.getString("created")));
  for (const record of rows) {
    try {
      const file = queueDir() + "/results/" + record.id + ".json";
      if (!exists(file)) {
        publish(app, record);
        continue;
      }
      const result = JSON.parse(toString($os.readFile(file)));
      if (result.id !== record.id || ["granted", "manual", "deferred"].indexOf(result.status) === -1) {
        throw new Error("Invalid grant result");
      }
      if (result.status === "deferred") {
        // Worker never contacted Google. Safe to retry in the next window.
        $os.remove(file);
        publish(app, record);
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
      record.set("grant_status", result.status);
      record.set("grant_error", result.status === "manual" ? errors[result.error] || errors.failed : "");
      app.save(record);
      if (result.status === "granted") {
        require(__hooks + "/lib/ntfy.js").notifyUser(app, record.getString("child"),
          "Screen time delivered 📱", minutesOf(record) + " minutes have landed.", "time_granted");
      }
      // Keep the receipt on disk: a repeated publish can never replay it.
      if (result.status === "manual") notifyManual(app, record);
    } catch (_) {
      // No raw errors: authenticated browser URLs and responses may hold secrets.
      app.logger().error("Family Link queue reconciliation failed", "spend", record.id);
    }
  }
}

module.exports = { prepare, publish, reconcile, notifyManual };
