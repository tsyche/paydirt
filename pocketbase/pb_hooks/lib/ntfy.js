// Shared ntfy helpers. NOT auto-loaded (filename isn't *.pb.js); require() this
// from inside hook handlers — PocketBase runs each handler in an isolated VM, so
// file-scope functions in a .pb.js are not visible inside its handlers.

function ntfyServer() {
  return $os.getenv("NTFY_SERVER") || "https://ntfy.sh";
}

function sendNtfy(app, topic, title, message) {
  if (!topic) return; // no topic configured — skip silently
  try {
    $http.send({
      url: ntfyServer() + "/" + topic,
      method: "POST",
      body: message,
      headers: { Title: title },
      timeout: 10,
    });
  } catch (err) {
    app.logger().error("ntfy send failed", "topic", topic, "error", String(err));
  }
}

function notifyUser(app, userId, title, message) {
  const user = app.findRecordById("users", userId);
  sendNtfy(app, user.getString("ntfy_topic"), title, message);
}

function notifyParents(app, householdId, title, message) {
  const parents = app.findRecordsByFilter(
    "users",
    "household = {:hh} && role = 'parent'",
    "",
    0,
    0,
    { hh: householdId },
  );
  for (const p of parents) {
    sendNtfy(app, p.getString("ntfy_topic"), title, message);
  }
}

module.exports = { sendNtfy, notifyUser, notifyParents };
