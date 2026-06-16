// Shared notification helpers. NOT auto-loaded (filename isn't *.pb.js); require()
// this from inside hook handlers — PocketBase runs each handler in an isolated VM.

function ntfyServer() {
  return $os.getenv("NTFY_SERVER") || "https://ntfy.sh";
}

function sendNtfy(app, topic, title, message) {
  if (!topic) return;
  if ($os.getenv("NTFY_DISABLED")) return;
  try {
    $http.send({
      url: ntfyServer() + "/" + encodeURIComponent(topic),
      method: "POST",
      body: message,
      headers: { Title: title },
      timeout: 10,
    });
  } catch (err) {
    app.logger().error("ntfy send failed", "topic", topic, "error", String(err));
  }
}

// Sends a UnifiedPush message to a specific endpoint URL. The endpoint is
// provided by ntfy (the UP distributor) and stored in users.up_endpoint.
// The body is JSON {title, body, type?} — decoded by UnifiedPushReceiver.kt.
// `type` is optional; when present it lets the receiver trigger specific automations
// (e.g. "spend_approved" fires ACTION_GRANT_SCREEN_TIME for Phase 2).
function sendViaEndpoint(app, endpoint, title, message, type) {
  if (!endpoint) return;
  if ($os.getenv("NTFY_DISABLED")) return;
  try {
    const payload = { title, body: message };
    if (type) payload.type = type;
    $http.send({
      url: endpoint,
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
      timeout: 10,
    });
  } catch (err) {
    app.logger().error("UP send failed", "endpoint", endpoint, "error", String(err));
  }
}

// Returns true when the current server time falls within the household's
// quiet window (quiet_start/quiet_end, both "HH:MM"). Handles wrap-around
// midnight (e.g. 22:00–07:00). Returns false when no window is configured.
function isQuietHours(app, householdId) {
  if (!householdId) return false;
  try {
    const hh = app.findRecordById("households", householdId);
    const qs = hh.getString("quiet_start");
    const qe = hh.getString("quiet_end");
    if (!qs || !qe) return false;
    const now = new Date();
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

// Notify a single user: prefer their UP endpoint (event-driven, no polling
// overhead), fall back to ntfy topic if no endpoint is registered.
// `type` is an optional string passed through to the UP payload for Phase 2 triggers.
function notifyUserRecord(app, user, title, message, type) {
  if (isQuietHours(app, user.getString("household"))) return;
  const endpoint = user.getString("up_endpoint");
  if (endpoint) {
    sendViaEndpoint(app, endpoint, title, message, type);
  } else {
    sendNtfy(app, user.getString("ntfy_topic"), title, message);
  }
}

function notifyUser(app, userId, title, message) {
  notifyUserRecord(app, app.findRecordById("users", userId), title, message);
}

function notifyRole(app, householdId, role, title, message, type) {
  const members = app.findRecordsByFilter(
    "users",
    "household = {:hh} && role = {:role}",
    "",
    0,
    0,
    { hh: householdId, role: role },
  );
  for (const m of members) {
    notifyUserRecord(app, m, title, message, type);
  }
}

function notifyParents(app, householdId, title, message, type) {
  notifyRole(app, householdId, "parent", title, message, type);
}

function notifyChildren(app, householdId, title, message) {
  notifyRole(app, householdId, "child", title, message);
}

module.exports = { sendNtfy, notifyUser, notifyParents, notifyChildren, notifyUserRecord };
