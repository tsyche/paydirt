// Shared notification helpers. NOT auto-loaded (filename isn't *.pb.js); require()
// this from inside hook handlers — PocketBase runs each handler in an isolated VM.

function ntfyServer() {
  return $os.getenv("NTFY_SERVER") || "https://ntfy.sh";
}

// Production hands transport to the notification worker. Inbox/realtime updates
// remain synchronous; an unreachable push endpoint must not hold an approval.
function deliver(request, inboxId) {
  const dir = $os.getenv("NTFY_QUEUE_DIR");
  if (!dir) {
    $http.send(request);
    return;
  }
  $os.mkdirAll(dir + "/pending", 0o700);
  const name = (inboxId || $security.randomString(15)) + $security.randomString(9) + ".json";
  const temporary = dir + "/" + name + ".tmp";
  $os.writeFile(temporary, JSON.stringify(request), 0o600);
  $os.rename(temporary, dir + "/pending/" + name);
}

function sendNtfy(app, topic, title, message, inboxId) {
  if (!topic) return;
  if ($os.getenv("NTFY_DISABLED")) return;
  try {
    deliver({
      url: ntfyServer() + "/" + encodeURIComponent(topic),
      method: "POST",
      body: message,
      headers: { Title: title },
      timeout: 10,
    }, inboxId);
  } catch (err) {
    app.logger().error("ntfy delivery failed", "error", "Notification transport or queue unavailable");
  }
}

// Sends a UnifiedPush message to a specific endpoint URL. The endpoint is
// provided by ntfy (the UP distributor) and stored in users.up_endpoint.
// The body is JSON {title, body, type?} — decoded by UnifiedPushReceiver.kt.
// `type` is optional; when present it lets the receiver trigger specific automations
// (e.g. "spend_approved" fires ACTION_GRANT_SCREEN_TIME for Phase 2).
function sendViaEndpoint(app, endpoint, title, message, type, inboxId) {
  if (!endpoint) return;
  if ($os.getenv("NTFY_DISABLED")) return;
  try {
    const payload = { title, body: message };
    if (type) payload.type = type;
    if (inboxId) payload.inboxId = inboxId;
    deliver({
      url: endpoint,
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
      timeout: 10,
    }, inboxId);
  } catch (err) {
    app.logger().error("UP delivery failed", "error", "Notification transport or queue unavailable");
  }
}

// Returns true when the current household time falls within the household's
// quiet window (quiet_start/quiet_end, both "HH:MM"). Handles wrap-around
// midnight (e.g. 22:00–07:00). Returns false when no window is configured.
function isQuietHours(app, householdId) {
  if (!householdId) return false;
  try {
    const hh = app.findRecordById("households", householdId);
    const qs = hh.getString("quiet_start");
    const qe = hh.getString("quiet_end");
    if (!qs || !qe) return false;
    const now = require(__hooks + "/lib/calendar.js").wall(hh, new Date());
    const cur = now.getHours() * 60 + now.getMinutes();
    const [sh, sm] = qs.split(":").map(Number);
    const [eh, em] = qe.split(":").map(Number);
    const start = sh * 60 + sm;
    const end = eh * 60 + em;
    return start <= end ? (cur >= start && cur < end) : (cur >= start || cur < end);
  } catch (_) {
    return false;
  }
}

// Keeps a per-user history of everything we push (also during quiet hours, when
// the push itself is skipped). Never lets a logging failure block the push.
function logToInbox(app, userId, title, message, type, source) {
  try {
    const item = new Record(app.findCollectionByNameOrId("inbox"));
    item.set("user", userId);
    item.set("title", title);
    item.set("body", message || "");
    item.set("type", type || "");
    item.set("source", source || "");
    app.save(item);
    return item.id;
  } catch (err) {
    app.logger().error("inbox log failed", "user", userId, "error", String(err));
  }
}

// Notify a single user: prefer their UP endpoint (event-driven, no polling
// overhead), fall back to ntfy topic if no endpoint is registered.
// `type` is an optional string passed through to the UP payload for Phase 2 triggers.
function notifyUserRecord(app, user, title, message, type, source) {
  const inboxId = logToInbox(app, user.id, title, message, type, source);
  if (isQuietHours(app, user.getString("household"))) return;
  const endpoint = user.getString("up_endpoint");
  if (endpoint) {
    sendViaEndpoint(app, endpoint, title, message, type, inboxId);
  } else {
    sendNtfy(app, user.getString("ntfy_topic"), title, message, inboxId);
  }
}

function notifyUser(app, userId, title, message, type, source) {
  notifyUserRecord(app, app.findRecordById("users", userId), title, message, type, source);
}

function notifyRole(app, householdId, role, title, message, type, source) {
  const members = app.findRecordsByFilter(
    "users",
    "household = {:hh} && role = {:role}",
    "",
    0,
    0,
    { hh: householdId, role: role },
  );
  for (const m of members) {
    notifyUserRecord(app, m, title, message, type, source);
  }
}

function notifyParents(app, householdId, title, message, type, source) {
  notifyRole(app, householdId, "parent", title, message, type, source);
}

function notifyChildren(app, householdId, title, message, type, source) {
  notifyRole(app, householdId, "child", title, message, type, source);
}

function clearSource(app, source, userId) {
  const rows = app.findRecordsByFilter("inbox",
    "source = {:source}" + (userId ? " && user = {:user}" : ""), "", 0, 0,
    { source, user: userId || "" });
  for (const row of rows) {
    app.delete(row);
    // Do not deliver a queued alert after its in-app source was cleared.
    const dir = $os.getenv("NTFY_QUEUE_DIR");
    if (dir) {
      try {
        for (const file of $os.readDir(dir + "/pending")) {
          if (file.name().startsWith(row.id)) {
            try { $os.remove(dir + "/pending/" + file.name()); } catch (_) { /* Already claimed. */ }
          }
        }
      } catch (_) { /* No queued pushes. */ }
    }
  }
}

module.exports = { clearSource, logToInbox, sendNtfy, sendViaEndpoint, notifyUser, notifyParents, notifyChildren, notifyUserRecord };
