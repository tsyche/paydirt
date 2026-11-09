import { TimeField } from "./TimeField";
import { Text } from "react-native-paper";
import { TextInput } from "./TextInput";

export function RecurringDueFields({ cadence, time, day, onTime, onDay }: {
  cadence: string; time: string; day: string;
  onTime: (value: string) => void; onDay: (value: string) => void;
}) {
  return <>
    <Text variant="bodySmall">Recurring deadline · household time. Blank time disables it.</Text>
    <TimeField label="Due time" value={time} onChange={onTime} />
    {cadence !== "daily" && <TextInput
      label={cadence === "weekly" ? "Due weekday (0 Sun–6 Sat)" : "Due day of month (1–31)"}
      value={day} onChangeText={onDay} keyboardType="number-pad" maxLength={2}
    />}
  </>;
}
