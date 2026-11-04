import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const roadmap = readFileSync(new URL("../../../ROADMAP.md", import.meta.url), "utf8");
const ledger = readFileSync(new URL("../../../docs/ledger/ROADMAP_SHIPPED.md", import.meta.url), "utf8");

describe("roadmap status hygiene", () => {
  it("keeps checked and struck-through completions out of active work", () => {
    expect(roadmap).not.toMatch(/~~|\[x\]|✅/);
  });

  it("does not check off explicitly unfinished work in the shipped index", () => {
    const index = ledger.split("## Archived entries")[0] ?? "";
    const entries = index.split("\n").filter((line) => line.startsWith("- [x]"));
    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) {
      expect(entry).not.toMatch(/(?:deployment|verification|validation) pending|awaiting (?:validation|deployment)|unverified|implemented locally|not (?:deployed|built|verified)/i);
    }
  });

  it("does not repeat a feature title in multiple active lists", () => {
    const titles = [...roadmap.matchAll(/^(?:-|\d+\.) \*\*([^*]+)\*\*/gm)].map((match) => match[1]!.toLowerCase());
    expect(new Set(titles).size).toBe(titles.length);
  });
});
