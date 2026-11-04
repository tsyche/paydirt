import { DELIVERY_DAYS, deliveryDays, deliverySummary, setDeliveryDay } from "@paydirt/shared";
import { TimeRangeField } from "./TimeRangeField";

type Schedule = { grant_weekday_window: string; grant_weekend_window: string; grant_day_windows: string };
function Hours({ label, value, onChange, inherit }: { label: string; value: string; onChange: (value: string) => void; inherit: string }) {
  const mode = !value ? "" : value === "all" || value === "none" ? value : "hours";
  return <div className="delivery-windows">
    <label>{label} <select aria-label={`${label} mode`} value={mode} onChange={(e) => onChange(e.target.value === "hours" ? "15:00-20:00" : e.target.value)}>
      <option value="">{inherit}</option><option value="all">All day</option><option value="hours">Specific hours</option><option value="none">No delivery</option>
    </select></label>
    {mode === "hours" && <TimeRangeField label={label} value={value} onChange={onChange} />}
  </div>;
}
export function DeliverySchedule({ value, onChange, kid = false }: { value: Schedule; onChange: (value: Schedule) => void; kid?: boolean }) {
  const days = deliveryDays(value.grant_day_windows);
  return <div>
    <p>Queued time is delivered only during these hours. Day exceptions replace the default.</p>
    <details className="settings-group"><summary>Default hours</summary>
      <Hours label="Weekdays" value={value.grant_weekday_window} inherit={kid ? "Use household" : "All day (default)"} onChange={(v) => onChange({ ...value, grant_weekday_window: v })} />
      <Hours label="Weekends" value={value.grant_weekend_window} inherit={kid ? "Use household" : "All day (default)"} onChange={(v) => onChange({ ...value, grant_weekend_window: v })} />
    </details>
    {[1, 2, 3, 4, 5, 6, 0].map((day) => {
      const fallback = day === 0 || day === 6 ? value.grant_weekend_window : value.grant_weekday_window;
      return <details className="settings-group" key={day}><summary>{DELIVERY_DAYS[day]} · {deliverySummary(days[day] || fallback, kid ? "Use household" : "All day")} {days[day] ? "(custom)" : "(default)"}</summary>
        <Hours label={`${DELIVERY_DAYS[day]} delivery`} value={days[day] || ""} inherit="Use default hours" onChange={(v) => onChange({ ...value, grant_day_windows: setDeliveryDay(value.grant_day_windows, day, v) })} />
      </details>;
    })}
  </div>;
}
