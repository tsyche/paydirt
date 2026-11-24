import { View } from "react-native";
import { TextInput } from "./TextInput";
import { TimeField } from "./TimeField";

/** Household-local date and clock time, matching the web datetime editor. */
export function DueDateField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [date, time = "00:00"] = value.split("T");
  return <View>
    <TextInput mode="outlined" label="Due date (optional)" value={date} onChangeText={(next) => onChange(next ? `${next}T${time}` : "")} keyboardType="numbers-and-punctuation" placeholder="YYYY-MM-DD" dense />
    {!!date && <TimeField label="Due time" value={time} onChange={(next) => onChange(`${date}T${next || "00:00"}`)} clearable={false} />}
  </View>;
}
