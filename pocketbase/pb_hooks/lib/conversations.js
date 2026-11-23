function append(app, assignment, kind, body, author, key) {
  const latest = app.findRecordsByFilter("chore_messages", "assignment = {:id}", "-sequence", 1, 0, { id: assignment.id });
  const r = new Record(app.findCollectionByNameOrId("chore_messages"));
  r.set("assignment", assignment.id); r.set("child", assignment.getString("child"));
  r.set("kind", kind); r.set("body", body || ""); r.set("request_key", key || "");
  r.set("sequence", latest.length ? latest[0].getInt("sequence") + 1 : 1);
  r.set("author", author ? author.id : "");
  r.set("author_name", author ? author.getString("display_name") : "PayDirt");
  r.set("author_role", author ? author.getString("role") : "system");
  app.save(r); return r;
}
function send(app, auth, id, body, key) {
  body = typeof body === "string" ? body.trim() : "";
  if (!body || body.length > 1000) throw new BadRequestError("Write 1–1,000 characters.");
  if (typeof key !== "string" || !/^[a-zA-Z0-9_-]{10,100}$/.test(key)) throw new BadRequestError("A retry key is required.");
  const assignment = app.findRecordById("assignments", id);
  const chore = app.findRecordById("chores", assignment.getString("chore"));
  const parent = auth.getString("role") === "parent" && auth.getString("household") === chore.getString("household");
  if (!parent && !(auth.getString("role") === "child" && auth.id === assignment.getString("child"))) throw new ForbiddenError("This conversation is private.");
  const previous = app.findRecordsByFilter("chore_messages", "author = {:author} && request_key = {:key}", "", 1, 0, { author: auth.id, key });
  if (previous.length) {
    if (previous[0].getString("body") !== body || previous[0].getString("assignment") !== id) throw new BadRequestError("This retry key belongs to another message.");
    return previous[0];
  }
  // Retry lookup stays above the limit: a lost response never consumes another slot.
  const recent = app.findRecordsByFilter("chore_messages",
    "assignment = {:id} && author = {:author} && kind = 'message' && request_key != '' && created >= {:since}",
    "", 20, 0, { id, author: auth.id, since: new Date(Date.now() - 10 * 60000).toISOString().replace("T", " ") });
  if (recent.length >= 20) {
    throw new ApiError(429, "Too many messages in this chore. Wait up to 10 minutes, then try again. Limit: 20 new messages per person per 10 minutes.");
  }
  return append(app, assignment, "message", body, auth, key);
}
module.exports = { append, send };
