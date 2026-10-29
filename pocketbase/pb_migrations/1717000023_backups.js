/// <reference path="../pb_data/types.d.ts" />

// Nightly consistent backup using PocketBase's built-in scheduler: a zip of the
// whole data dir (SQLite snapshot + uploads) in <data dir>/backups, newest 7
// kept. 02:30 server time avoids the 03:00 paydirt_daily job. This only guards
// against bad writes and corruption; get a copy off the host with
// `just backup-pull` (see docs/DEPLOYMENT.md#backups).
migrate(
  (app) => {
    const settings = app.settings();
    settings.backups.cron = "30 2 * * *";
    settings.backups.cronMaxKeep = 7;
    app.save(settings);
  },
  (app) => {
    const settings = app.settings();
    settings.backups.cron = "";
    app.save(settings);
  },
);
