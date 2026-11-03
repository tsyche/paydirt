/// <reference path="../pb_data/types.d.ts" />
onRecordCreateRequest((e) => {
  require(__hooks + "/lib/grantWindows.js").validate(e.record);
  e.next();
}, "households");
onRecordUpdateRequest((e) => {
  require(__hooks + "/lib/grantWindows.js").validate(e.record);
  e.next();
}, "households");
