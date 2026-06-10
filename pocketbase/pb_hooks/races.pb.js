/// <reference path="../pb_data/types.d.ts" />

// Race mechanic: a race chore is assigned to several kids; the first one whose
// completion gets APPROVED wins the reward, and every other open assignment
// for that chore is closed. Hook saves run in app context, so the guards
// don't apply here.

onRecordAfterUpdateSuccess((e) => {
  const becameApproved =
    e.record.getString("status") === "approved" &&
    e.record.original().getString("status") !== "approved";
  if (!becameApproved) {
    e.next();
    return;
  }
  const chore = e.app.findRecordById("chores", e.record.getString("chore"));
  if (!chore.getBool("race")) {
    e.next();
    return;
  }

  const { notifyUser } = require(`${__hooks}/lib/ntfy.js`);
  const winner = e.app.findRecordById("users", e.record.getString("child"));
  const siblings = e.app.findRecordsByFilter(
    "assignments",
    "chore = {:chore} && id != {:id} && (status = 'assigned' || status = 'completed' || status = 'rejected')",
    "",
    0,
    0,
    { chore: chore.id, id: e.record.id },
  );
  for (const a of siblings) {
    a.set("status", "closed");
    e.app.save(a);
    notifyUser(
      e.app,
      a.getString("child"),
      "Race over: " + chore.getString("name"),
      winner.getString("display_name") + " got there first — better luck next time! 🏁",
    );
  }
  e.next();
}, "assignments");
