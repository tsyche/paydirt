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
// The body is JSON {title, body} — decoded by UnifiedPushReceiver.kt.
// The endpoint URL encodes the ntfy server, so self-hosted migration is
// transparent: re-registration gives a new URL pointing to the new server.
function sendViaEndpoint(app, endpoint, title, message) {
  if (!endpoint) return;
  if ($os.getenv("NTFY_DISABLED")) return;
  try {
    $http.send({
      url: endpoint,
      method: "POST",
      body: JSON.stringify({ title, body: message }),
      headers: { "Content-Type": "application/json" },
      timeout: 10,
    });
  } catch (err) {
    app.logger().error("UP send failed", "endpoint", endpoint, "error", String(err));
  }
}

// Notify a single user: prefer their UP endpoint (event-driven, no polling
// overhead), fall back to ntfy topic if no endpoint is registered.
function notifyUserRecord(app, user, title, message) {
  const endpoint = user.getString("up_endpoint");
  if (endpoint) {
    sendViaEndpoint(app, endpoint, title, message);
  } else {
    sendNtfy(app, user.getString("ntfy_topic"), title, message);
  }
}

function notifyUser(app, userId, title, message) {
  notifyUserRecord(app, app.findRecordById("users", userId), title, message);
}

function notifyRole(app, householdId, role, title, message) {
  const members = app.findRecordsByFilter(
    "users",
    "household = {:hh} && role = {:role}",
    "",
    0,
    0,
    { hh: householdId, role: role },
  );
  for (const m of members) {
    notifyUserRecord(app, m, title, message);
  }
}

function notifyParents(app, householdId, title, message) {
  notifyRole(app, householdId, "parent", title, message);
}

function notifyChildren(app, householdId, title, message) {
  notifyRole(app, householdId, "child", title, message);
}

module.exports = { sendNtfy, notifyUser, notifyParents, notifyChildren };
