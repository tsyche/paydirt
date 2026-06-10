/// <reference path="../pb_data/types.d.ts" />

// Cron registration + manual triggers. Job bodies live in lib/scheduler.js.
// Schedules use the server's local time.

cronAdd("paydirt_tick", "*/10 * * * *", () => {
  const { runTick } = require(`${__hooks}/lib/scheduler.js`);
  runTick($app);
});

cronAdd("paydirt_daily", "0 3 * * *", () => {
  const { runDaily } = require(`${__hooks}/lib/scheduler.js`);
  runDaily($app);
});

cronAdd("paydirt_digest", "0 18 * * 0", () => {
  const { runWeeklyDigest } = require(`${__hooks}/lib/scheduler.js`);
  runWeeklyDigest($app);
});

// Superuser-only manual triggers so the cron bodies are testable (and
// debuggable) without waiting for the schedule.
routerAdd(
  "POST",
  "/api/paydirt/cron/{job}",
  (e) => {
    const job = e.request.pathValue("job");
    const { runTick, runDaily, runWeeklyDigest } = require(`${__hooks}/lib/scheduler.js`);
    if (job === "tick") runTick(e.app);
    else if (job === "daily") runDaily(e.app);
    else if (job === "digest") runWeeklyDigest(e.app);
    else throw new ApiError(404, "Unknown job: " + job);
    return e.json(200, { ran: job });
  },
  $apis.requireSuperuserAuth(),
);
