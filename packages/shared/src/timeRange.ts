/** Time-of-day helpers shared by the web and mobile time pickers. Values are 24-hour "HH:MM". */
export interface TimeRange {
  start: string;
  end: string;
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isTime(value: string): boolean {
  return TIME.test(value);
}

/** "HH:MM-HH:MM" -> parts, or null when blank, 'all', or malformed. */
export function parseTimeRange(value: string): TimeRange | null {
  const [start, end, ...rest] = value.split("-");
  if (rest.length || !start || !end || !isTime(start) || !isTime(end)) return null;
  return { start, end };
}

/** Parts -> "HH:MM-HH:MM"; blank until both ends are set, so half-picked input never saves. */
export function formatTimeRange(start: string, end: string): string {
  return isTime(start) && isTime(end) ? `${start}-${end}` : "";
}

/** Human message for a range the server would reject, else "". Blank and 'all' are valid. */
export function timeRangeError(value: string, allowAll = false): string {
  if (!value || (allowAll && value === "all")) return "";
  const range = parseTimeRange(value);
  if (!range) return "Pick both a start and an end time.";
  if (range.start === range.end) return "Start and end can't be the same time.";
  return "";
}

/** "15:30" -> "3:30 PM" for display; returns the input unchanged if it isn't a valid time. */
export function formatTime12(value: string): string {
  if (!isTime(value)) return value;
  const hours = Number(value.slice(0, 2));
  const suffix = hours < 12 ? "AM" : "PM";
  return `${hours % 12 || 12}:${value.slice(3)} ${suffix}`;
}
