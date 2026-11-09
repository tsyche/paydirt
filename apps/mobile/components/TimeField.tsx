import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { Button, Text } from "react-native-paper";
import { TextInput } from "./TextInput";
import { formatTime12, formatTimeRange, isTime, parseTimeRange, timeRangeError } from "@paydirt/shared";

function toDate(value: string): Date {
  const d = new Date();
  if (isTime(value)) d.setHours(Number(value.slice(0, 2)), Number(value.slice(3)), 0, 0);
  return d;
}

function toValue(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Tap to pick a time with the system clock dialog; value is 24-hour "HH:MM", "" when unset. */
export function TimeField({
  label,
  value,
  onChange,
  clearable = true,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  clearable?: boolean;
}) {
  function open() {
    DateTimePickerAndroid.open({
      value: toDate(value),
      mode: "time",
      is24Hour: false,
      onChange: (event, date) => {
        if (event.type === "set" && date) onChange(toValue(date));
      },
    });
  }
  return (
    <Pressable onPress={open} accessibilityRole="button" accessibilityLabel={`${label}: ${value ? formatTime12(value) : "not set"}`} style={styles.flex}>
      <View pointerEvents="none">
        <TextInput
          dense
          mode="outlined"
          label={label}
          value={value ? formatTime12(value) : ""}
          placeholder="Tap to pick"
          editable={false}
          right={clearable && value ? undefined : <TextInput.Icon icon="clock-outline" />}
        />
      </View>
      {clearable && !!value && (
        <Pressable onPress={() => onChange("")} accessibilityLabel={`Clear ${label}`} hitSlop={8} style={styles.clear}>
          <Text>✕</Text>
        </Pressable>
      )}
    </Pressable>
  );
}

/** Start/end time pickers that read and write "HH:MM-HH:MM"; blank until both ends are set. */
function SingleTimeRangeField({
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
  // Follow outside changes without clobbering a half-picked range.
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
  const error = timeRangeError(value, allowAll) || (!value && (start || end) ? "Pick both a start and an end time." : "");
  if (allowAll && value === "all") {
    return (
      <View style={styles.row}>
        <Text style={styles.flex}>{label}: All day</Text>
        <Pressable onPress={() => update("", "")} accessibilityRole="button"><Text>Set hours</Text></Pressable>
      </View>
    );
  }
  return (
    <View>
      <View style={styles.row}>
        <TimeField label="From" value={start} onChange={(v) => update(v, end)} />
        <TimeField label="Until" value={end} onChange={(v) => update(start, v)} />
      </View>
      {allowAll && (
        <Pressable onPress={() => onChange("all")} accessibilityRole="button" style={styles.allDay}><Text>All day</Text></Pressable>
      )}
      {!!error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

export function TimeRangeField({ value, onChange, ...props }: { label: string; value: string; onChange: (value: string) => void; allowAll?: boolean }) {
  const [rows, setRows] = useState(value ? value.split(",") : []);
  useEffect(() => { setRows(value ? value.split(",") : []); }, [value]);
  function update(next: string[]) {
    setRows(next);
    onChange(next.join(","));
  }
  return <View style={{ gap: 12, marginVertical: 16 }}>
    <Text variant="titleSmall">{props.label}</Text>
    {!rows.length && <Text>{props.allowAll ? "Use household windows" : "All day"}</Text>}
    {value === "all" ? <Text>All day</Text> : rows.map((row, index) => <View key={index} style={{ gap: 8, padding: 12, borderWidth: 1, borderColor: "#888", borderRadius: 12 }}>
    <Text variant="labelLarge">Window {index + 1}</Text>
    <SingleTimeRangeField {...props} allowAll={false} label={`${props.label} ${index + 1}`} value={row} onChange={(next) => update(rows.map((old, i) => i === index ? next : old))} />
    {index === rows.length - 1 && <Button mode="outlined" icon="minus" onPress={() => update(rows.slice(0, -1))}>Remove last window</Button>}
  </View>)}
    {value !== "all" && <Button mode="outlined" icon="plus" disabled={rows.some((row) => !parseTimeRange(row))} onPress={() => { setRows([...rows, ""]); }}>Add window</Button>}
    {props.allowAll && <Button mode="text" onPress={() => update(value === "all" ? [] : ["all"])}>{value === "all" ? "Use household windows" : "Allow all day"}</Button>}
  </View>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: "row", gap: 8, alignItems: "center" },
  clear: { position: "absolute", right: 12, top: 0, bottom: 0, justifyContent: "center" },
  allDay: { alignSelf: "flex-start", paddingVertical: 6 },
  error: { color: "#b3261e", fontSize: 12 },
});
