import { useEffect, useState } from "react";
import { formatTimeRange, parseTimeRange, timeRangeError } from "@paydirt/shared";

/**
 * Start/end time pickers (native clock UI) that read and write "HH:MM-HH:MM".
 * Blank until both ends are picked; `allowAll` adds an 'all' (all day) value for per-kid overrides.
 */
export function TimeRangeField({
  label,
  value,
  onChange,
  allowAll = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  allowAll?: boolean;
}) {
  const parsed = parseTimeRange(value);
  const [start, setStart] = useState(parsed?.start ?? "");
  const [end, setEnd] = useState(parsed?.end ?? "");

  // Follow outside changes (reload, reset) without clobbering a half-picked range.
  useEffect(() => {
    if (value === formatTimeRange(start, end)) return;
    const next = parseTimeRange(value);
    setStart(next?.start ?? "");
    setEnd(next?.end ?? "");
  }, [value]);

  function update(nextStart: string, nextEnd: string) {
    setStart(nextStart);
    setEnd(nextEnd);
    onChange(formatTimeRange(nextStart, nextEnd));
  }

  const error = timeRangeError(value, allowAll);
  const half = !value && (start || end) ? "Pick both a start and an end time." : "";

  if (allowAll && value === "all") {
    return (
      <div className="time-range" role="group" aria-label={label}>
        <span className="time-range-all">All day</span>
        <button type="button" className="sm" onClick={() => update("", "")}>Set hours</button>
      </div>
    );
  }

  return (
    <div className="time-range" role="group" aria-label={label}>
      <input type="time" aria-label={`${label} start`} value={start} onChange={(e) => update(e.target.value, end)} />
      <span aria-hidden="true">to</span>
      <input type="time" aria-label={`${label} end`} value={end} onChange={(e) => update(start, e.target.value)} />
      {(start || end) && <button type="button" className="sm" onClick={() => update("", "")}>Clear</button>}
      {allowAll && <button type="button" className="sm" onClick={() => onChange("all")}>All day</button>}
      {(error || half) && <span className="error time-range-error">{error || half}</span>}
    </div>
  );
}
