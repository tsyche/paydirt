export function RecurringDueFields({ cadence, time, day, onTime, onDay }: {
  cadence: string; time: string; day: number;
  onTime: (value: string) => void; onDay: (value: number) => void;
}) {
  return <div className="inline">
    <label>Recurring due time (server-local; blank = off) <input type="time" value={time} onChange={(e) => onTime(e.target.value)} /></label>
    {cadence === "weekly" && <label>Due weekday <select value={day} onChange={(e) => onDay(Number(e.target.value))}>
      {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((name, i) => <option key={name} value={i}>{name}</option>)}
    </select></label>}
    {cadence === "monthly" && <label>Due day of month <input type="number" min={1} max={31} value={day} onChange={(e) => onDay(Number(e.target.value))} /></label>}
  </div>;
}
