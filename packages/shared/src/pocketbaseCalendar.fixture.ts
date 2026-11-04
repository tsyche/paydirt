// PocketBase's Go time bridge is a runtime boundary, absent in Node unit tests.
import { vi } from "vitest";
import { getHouseholdTimeZone, setHouseholdTimeZone, localDateInstant } from "./dates";
export function installPocketBaseCalendar(): void {
  vi.stubGlobal("Timezone", class { constructor(public name: string) {} });
  vi.stubGlobal("DateTime", class {
    private date: Date;
    private zone = "UTC";
    constructor(value: string, zone?: string) {
      if (zone) {
        const before = getHouseholdTimeZone();
        try { setHouseholdTimeZone(zone); this.date = new Date(localDateInstant(value.replace(" ", "T"))); }
        finally { setHouseholdTimeZone(before); }
      } else this.date = new Date(value.replace(" ", "T"));
    }
    string() { return this.date.toISOString().replace("T", " "); }
    time() { return this; }
    in(zone: { name: string }) { this.zone = zone.name; return this; }
    format(layout: string) {
      const parts = new Intl.DateTimeFormat("en-GB", { timeZone: this.zone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(this.date);
      const part = (type: string) => parts.find((p) => p.type === type)!.value;
      if (layout === "15") return part("hour");
      if (layout === "04") return part("minute");
      const date = `${part("year")}-${part("month")}-${part("day")}`;
      return layout.includes("15:04:05") ? `${date}T${part("hour")}:${part("minute")}:${part("second")}` : date;
    }
    weekday() { return new Date(`${this.format("2006-01-02")}T12:00:00Z`).getUTCDay(); }
  });
}
