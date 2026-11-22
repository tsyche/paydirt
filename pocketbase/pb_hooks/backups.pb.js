/// <reference path="../pb_data/types.d.ts" />

// Keep the creating binary's version inside the snapshot for restore drills.
onBackupCreate((e) => {
  const version = toString($os.cmd($os.args[0], "--version").output()).match(/\b\d+\.\d+\.\d+\b/);
  if (!version) throw new Error("Cannot record PocketBase backup version.");
  $os.writeFile(e.app.dataDir() + "/paydirt-backup.json", JSON.stringify({
    pocketbaseVersion: version[0],
    createdAt: new Date().toISOString(),
  }), 0o600);
  e.next();
});
