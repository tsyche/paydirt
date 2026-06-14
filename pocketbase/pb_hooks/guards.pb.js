/// <reference path="../pb_data/types.d.ts" />

// Authorization guards that the declarative collection rules can't express
// (they depend on the *value* a field is changing to, not just who's asking).
// onRecordUpdateRequest fires only for API requests, so internal hook saves
// (e.app.save) are never blocked by these.

// Assignment status + swap authority. The update rule lets the owning child,
// the swap target, and household parents PATCH an assignment; this pins down
// what each is actually allowed to do.
onRecordUpdateRequest((e) => {
  const isParent = e.auth && e.auth.getString("role") === "parent";
  const authId = e.auth ? e.auth.id : "";
  const status = e.record.getString("status");
  const prev = e.record.original().getString("status");

  if (!isParent) {
    // Only parents move chores into a settled state...
    if (status !== prev && (status === "approved" || status === "rejected" || status === "closed")) {
      throw new ForbiddenError("Only a parent can approve, reject, or close a chore.");
    }
    // ...and settled chores are off-limits entirely (leaving "approved"
    // triggers a balance reversal; "closed" means the race is over).
    if (prev === "approved" || prev === "closed") {
      throw new ForbiddenError("This chore is settled.");
    }

    const child = e.record.original().getString("child");
    const swapTo = e.record.original().getString("swap_to");
    const newChild = e.record.getString("child");
    const newSwapTo = e.record.getString("swap_to");

    if (authId === child) {
      // Owner: anything the rules allow except reassigning the chore.
      if (newChild !== child) {
        throw new ForbiddenError("You can't hand a chore to someone else directly — offer a swap.");
      }
      // A swap offer must target a sibling in the same household.
      if (newSwapTo && newSwapTo !== swapTo) {
        const target = e.app.findRecordById("users", newSwapTo);
        if (
          target.getString("role") !== "child" ||
          target.getString("household") !== e.auth.getString("household") ||
          target.id === authId
        ) {
          throw new ForbiddenError("Swaps can only be offered to a sibling.");
        }
      }
    } else if (authId === swapTo) {
      // Swap target: may only accept (take ownership + clear the offer) or
      // decline (clear the offer). Nothing else.
      const accepts = newChild === authId && newSwapTo === "";
      const declines = newChild === child && newSwapTo === "";
      if (!accepts && !declines) {
        throw new ForbiddenError("You can only accept or decline this swap offer.");
      }
      if (status !== prev) {
        throw new ForbiddenError("Accept or decline the swap before changing the chore.");
      }
    }
  }
  e.next();
}, "assignments");

// Photo rules, applied during the update lifecycle (after new values are
// applied, before save):
//  - photo-required chores can't be completed without a photo
//  - resubmitting a REJECTED chore always needs a freshly uploaded photo,
//    even if the chore doesn't normally require one (proof after a dispute)
// NOTE: mid-update, a freshly uploaded file is a file object on the record,
// not a filename string yet — getString() returns "" for it and would reject
// legitimate uploads. get() is truthy for both a pending upload and an
// already-saved filename; a non-string value means a NEW upload.
onRecordUpdate((e) => {
  const newStatus = e.record.getString("status");
  const prevStatus = e.record.original().getString("status");
  if (newStatus === "completed" && prevStatus !== "completed") {
    const photo = e.record.get("photo");
    const hasPhoto = !!photo && (!Array.isArray(photo) || photo.length > 0);
    // Non-string = FormData file object (mid-save). String starting with "data:"
    // = base64 data URI uploaded via JSON (PocketBase processes it server-side).
    const isNewUpload = hasPhoto && (typeof photo !== "string" || photo.startsWith("data:"));

    if (prevStatus === "rejected") {
      if (!isNewUpload) {
        throw new ApiError(400, "Resubmitting needs a new photo for proof — snap one first.");
      }
    } else {
      const chore = e.app.findRecordById("chores", e.record.getString("chore"));
      if (chore.getBool("photo_required") && !hasPhoto) {
        throw new ApiError(400, "This chore requires a photo — snap one first.");
      }
    }
  }
  e.next();
}, "assignments");
