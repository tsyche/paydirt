import { createElement, type ComponentProps, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { setHouseholdTimeZone } from "@paydirt/shared";
import { readFileSync } from "node:fs";
vi.mock("react-native-paper", () => ({ Text: ({ children }: { children: ReactNode }) => createElement("span", null, children) }));
import { OccurrenceLabel } from "./OccurrenceLabel";
const assignment = (created: string, type: "recurring" | "oneoff" = "recurring") => ({ created, expand: { chore: { type } } }) as ComponentProps<typeof OccurrenceLabel>["assignment"];
describe("recurring occurrence labels", () => {
  it("distinguishes yesterday's pending submission from today's card using the household date", () => {
    setHouseholdTimeZone("America/Los_Angeles");
    const yesterday = renderToStaticMarkup(createElement(OccurrenceLabel, { assignment: assignment("2026-11-06T07:30:00Z") }));
    const today = renderToStaticMarkup(createElement(OccurrenceLabel, { assignment: assignment("2026-11-06T08:01:00Z") }));
    expect(yesterday).toContain("11/5/2026");
    expect(today).toContain("11/6/2026");
    expect(yesterday).not.toEqual(today);
  });
  it("omits an occurrence date for one-off chores", () => {
    expect(renderToStaticMarkup(createElement(OccurrenceLabel, { assignment: assignment("2026-11-06T08:01:00Z", "oneoff") }))).toBe("");
  });
  it("wires dates into standard cards and simplified active, rejected, and waiting cards", () => {
    const standard = readFileSync(new URL("../screens/KidHome.tsx", import.meta.url), "utf8");
    const simple = readFileSync(new URL("../screens/SimpleKidHome.tsx", import.meta.url), "utf8");
    expect(standard).toContain("<OccurrenceLabel assignment={a} />");
    expect(simple.match(/<OccurrenceLabel assignment=\{a\} \/>/g)).toHaveLength(3);
  });
});
