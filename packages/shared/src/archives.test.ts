import { describe, expect, it } from "vitest";
import { archiveDetails, archiveLabel, completesArchiveSwipe, startsArchiveSwipe, type ArchivedItem } from "./archives";

describe("archive swipe intent", () => {
  it.each([-1, 1])("accepts deliberate horizontal swipes in direction %s", (direction) => {
    expect(startsArchiveSwipe(direction * 30, 5)).toBe(true);
    expect(completesArchiveSwipe(direction * 90, 10)).toBe(true);
    expect(completesArchiveSwipe(direction * 40, 5)).toBe(false);
  });
  it("preserves taps, vertical scrolling, and abandoned diagonal gestures", () => {
    expect(startsArchiveSwipe(8, 2)).toBe(false);
    expect(startsArchiveSwipe(30, 80)).toBe(false);
    expect(completesArchiveSwipe(90, 100)).toBe(false);
  });
});

describe("archived record content", () => {
  it("keeps an alert's original message and a chore's approval feedback readable", () => {
    const alert = { expand: { inbox: { title: "Good news", body: "You earned five minutes." } } } as ArchivedItem;
    expect(archiveLabel(alert)).toBe("Good news");
    expect(archiveDetails(alert)).toBe("You earned five minutes.");
    const chore = { expand: { assignment: { approval_comment: "Thanks for sticking with it.", expand: { chore: { name: "Dishes" } } } } } as ArchivedItem;
    expect(archiveLabel(chore)).toBe("Dishes");
    expect(archiveDetails(chore)).toBe("Parent feedback: Thanks for sticking with it.");
  });
});
