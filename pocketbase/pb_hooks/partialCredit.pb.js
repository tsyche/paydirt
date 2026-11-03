/// <reference path="../pb_data/types.d.ts" />
onRecordCreateRequest((e) => {
  e.record.set("credit_percent", 0);
  e.next();
}, "assignments");

onRecordUpdateRequest((e) => {
  const before = e.record.original();
  const approving = before.getString("status") !== "approved" && e.record.getString("status") === "approved";
  const percent = e.record.getFloat("credit_percent");
  if (percent !== before.getFloat("credit_percent") && !approving) {
    throw new ForbiddenError("Credit can only change when approving a chore.");
  }
  if (approving) {
    if (!e.auth || e.auth.getString("role") !== "parent") {
      throw new ForbiddenError("Only parents decide partial credit.");
    }
    const effective = percent || 100;
    if (!Number.isInteger(effective) || effective < 1 || effective > 100) {
      throw new BadRequestError("Credit must be between 1 and 100 percent.");
    }
    const chore = e.app.findRecordById("chores", e.record.getString("chore"));
    const pay = require(__hooks + "/lib/chorePay.js").partialPay(chore, effective);
    if (pay.bucks <= 0 && pay.minutes <= 0) {
      throw new BadRequestError("This percentage pays nothing. Choose a higher percentage.");
    }
    e.record.set("credit_percent", effective);
  }
  e.next();
}, "assignments");
