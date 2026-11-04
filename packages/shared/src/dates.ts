export const DEFAULT_TIME_ZONE = "America/Los_Angeles";
let householdTimeZone = DEFAULT_TIME_ZONE;
/** This single-household app loads its calendar setting alongside household data. */
export function setHouseholdTimeZone(value?: string): void {
  const zone = value || DEFAULT_TIME_ZONE;
  new Intl.DateTimeFormat("en", { timeZone: zone }).format();
  householdTimeZone = zone;
}
export function getHouseholdTimeZone(): string { return householdTimeZone; }

/** Calendar key in the configured household timezone, suitable for date inputs. */
export function localDateKey(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value.replace(" ", "T")) : value;
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en", { timeZone: householdTimeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

/** PocketBase timestamps are UTC; show their date in the viewer's timezone. */
export function localDateLabel(value: string): string {
  return value ? new Date(value.replace(" ", "T")).toLocaleDateString(undefined, { timeZone: householdTimeZone }) : "";
}

/** Interpret a date-only form value as local midnight, never UTC midnight. */
export function localDateInstant(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?)?$/.test(value)) return new Date(value.replace(" ", "T")).toISOString();
  const desired = new Date(value.length === 10 ? `${value}T00:00:00Z` : `${value}Z`).getTime();
  let instant = desired;
  for (let i = 0; i < 3; i++) {
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone: householdTimeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(new Date(instant));
    const part = (type: string) => Number(parts.find((p) => p.type === type)!.value);
    const shown = Date.UTC(part("year"), part("month") - 1, part("day"), part("hour"), part("minute"), part("second"));
    instant += desired - shown;
  }
  const result = new Date(instant).toISOString();
  const expected = value.length === 10 ? `${value}T00:00` : value.slice(0, 16);
  if (householdDateTimeInput(result) !== expected) throw new Error("This time does not exist in the household timezone. Choose another time.");
  return result;
}

export function householdDateTime(value: string): string {
  return value ? new Date(value.replace(" ", "T")).toLocaleString(undefined, { timeZone: householdTimeZone }) : "";
}

export function householdDateTimeInput(value: string): string {
  const date = new Date(value.replace(" ", "T"));
  if (!value || Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: householdTimeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  return `${localDateKey(date)}T${parts.find((p) => p.type === "hour")!.value}:${parts.find((p) => p.type === "minute")!.value}`;
}

/** Wall-clock proxy for calendar-only arithmetic; never use for elapsed time. */
export function householdWallDate(value = new Date()): Date {
  return new Date(householdDateTimeInput(value.toISOString()));
}

export function householdMonthRange(year: number, month: number): { start: string; end: string } {
  const start = new Date(Date.UTC(year, month - 1, 1)).toISOString().slice(0, 10);
  const end = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
  return { start: localDateInstant(start), end: localDateInstant(end) };
}

export function nextHouseholdTime(time: string, tomorrow = false, now = new Date()): Date {
  let key = localDateKey(now);
  let result = new Date(localDateInstant(`${key}T${time}`));
  if (tomorrow || result <= now) {
    const day = new Date(`${key}T12:00:00Z`);
    day.setUTCDate(day.getUTCDate() + 1);
    key = day.toISOString().slice(0, 10);
    result = new Date(localDateInstant(`${key}T${time}`));
  }
  return result;
}
