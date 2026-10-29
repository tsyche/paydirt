// PocketBase owns approval/status; the separate worker owns Google's session.
// A committed queued row is the outbox. The cron repairs a failed file publish.
function queueDir() {
  return $os.getenv("FL_QUEUE_DIR") || "/var/lib/paydirt/familylink/queue";
}

function exists(file) {
  try { $os.stat(file); return true; } catch (_) { return false; }
}

function prepare(record, app) {
  if (!record.getInt("screen_minutes")) return;
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
  const job = {
    id: record.id,
    childId: child.getString("fl_child_id"),
    deviceId: child.getString("fl_device_id"),
    seconds: record.getInt("screen_minutes") * 60,
  };
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
    "status = 'approved' && grant_status = 'queued'", "created", 0, 0);
  for (const record of rows) {
    try {
      const file = queueDir() + "/results/" + record.id + ".json";
      if (!exists(file)) {
        publish(app, record);
        continue;
      }
      const result = JSON.parse(toString($os.readFile(file)));
      if (result.id !== record.id || ["granted", "manual"].indexOf(result.status) === -1) {
        throw new Error("Invalid grant result");
      }
      const errors = {
        session_expired: "Family Link session expired. Run fl-login and fl-host-setup on the Mac, then grant manually.",
        interrupted: "The grant was interrupted and may have succeeded. Check Family Link before granting manually.",
        failed: "The grant failed and may have succeeded. Check Family Link before granting manually.",
        disabled: "Automatic grants are disabled. Grant the time manually.",
        invalid_request: "The grant target or duration is invalid. Check the child's settings and grant manually.",
      };
      record.set("grant_status", result.status);
      record.set("grant_error", result.status === "manual" ? errors[result.error] || errors.failed : "");
      app.save(record);
      // Keep the receipt on disk: a repeated publish can never replay it.
      if (result.status === "manual") notifyManual(app, record);
    } catch (_) {
      // No raw errors: authenticated browser URLs and responses may hold secrets.
      app.logger().error("Family Link queue reconciliation failed", "spend", record.id);
    }
  }
}

module.exports = { prepare, publish, reconcile, notifyManual };
