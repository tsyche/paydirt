import { useState } from "react";
import { View } from "react-native";
import { Button, List, SegmentedButtons, Text } from "react-native-paper";
import { DELIVERY_DAYS, deliveryDays, deliverySummary, setDeliveryDay } from "@paydirt/shared";
import { TimeRangeField } from "./TimeField";

type Schedule = { grant_weekday_window: string; grant_weekend_window: string; grant_day_windows: string };
function Hours({ label, value, onChange, inherit }: { label: string; value: string; onChange: (value: string) => void; inherit: string }) {
  const mode = !value ? "default" : value === "none" || value === "all" ? value : "hours";
  return <View style={{ gap: 12, paddingVertical: 12 }}>
    <Text variant="titleSmall">{label}</Text>
    <Button mode={mode === "default" ? "contained-tonal" : "outlined"} onPress={() => onChange("")}>{inherit}</Button>
    <SegmentedButtons value={mode} onValueChange={(next) => onChange(next === "hours" ? "15:00-20:00" : next)} buttons={[
      { value: "all", label: "All day" }, { value: "hours", label: "Hours" }, { value: "none", label: "No delivery" },
    ]} />
    {mode === "none" && <Text>No queued time will be delivered.</Text>}
    {mode === "hours" && <TimeRangeField label={label} value={value} onChange={onChange} />}
  </View>;
}
export function DeliverySchedule({ value, onChange, kid = false }: { value: Schedule; onChange: (value: Schedule) => void; kid?: boolean }) {
  const [selected, setSelected] = useState<number | null>(null);
  const days = deliveryDays(value.grant_day_windows);
  return <View style={{ gap: 12 }}>
    <Text>Queued time is delivered only during these hours. Day exceptions replace the default.</Text>
    <List.Accordion title="Default hours" description={kid ? "Inherit household unless changed" : "Weekday and weekend defaults"}>
      <Hours label="Weekdays" value={value.grant_weekday_window} inherit={kid ? "Use household" : "All day (default)"} onChange={(v) => onChange({ ...value, grant_weekday_window: v })} />
      <Hours label="Weekends" value={value.grant_weekend_window} inherit={kid ? "Use household" : "All day (default)"} onChange={(v) => onChange({ ...value, grant_weekend_window: v })} />
    </List.Accordion>
    <Text variant="titleSmall">Daily schedule · tap a day to change it</Text>
    {[1, 2, 3, 4, 5, 6, 0].map((day) => {
      const fallback = (day === 0 || day === 6) ? value.grant_weekend_window : value.grant_weekday_window;
      return <View key={day}>
        <List.Item title={DELIVERY_DAYS[day]} description={deliverySummary(days[day] || fallback, kid ? "Use household" : "All day") + (days[day] ? " · custom" : " · default")} accessibilityState={{ expanded: selected === day }} onPress={() => setSelected(selected === day ? null : day)} right={(props) => <List.Icon {...props} icon={selected === day ? "chevron-up" : "chevron-down"} />} />
        {selected === day && <Hours label={`${DELIVERY_DAYS[day]} delivery`} value={days[day] || ""} inherit="Use default hours" onChange={(v) => onChange({ ...value, grant_day_windows: setDeliveryDay(value.grant_day_windows, day, v) })} />}
      </View>;
    })}
  </View>;
}
