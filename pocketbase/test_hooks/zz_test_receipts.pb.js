// Disposable browser-test fixture only. Never copy this into production hooks.
// A foreground refresh must import the receipt without help from the cron.
cronRemove("paydirt_familylink");
routerAdd("POST", "/test/receipt/{id}", (e) => {
  const id = e.request.pathValue("id");
  const grant = e.app.findRecordById("time_grants", id);
  const dir = $os.getenv("FL_QUEUE_DIR");
  const job = JSON.parse(toString($os.readFile(dir + "/pending/" + id + ".json")));
  $os.writeFile(dir + "/results/" + id + ".json", JSON.stringify({ id, status: "granted", deliveredSeconds: job.seconds }), 0o600);
  $os.remove(dir + "/pending/" + id + ".json");
  return e.json(200, { id: grant.id });
}, $apis.requireSuperuserAuth());
