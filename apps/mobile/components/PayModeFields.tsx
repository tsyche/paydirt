import { View, StyleSheet } from "react-native";
import { SegmentedButtons, Text, TextInput, useTheme } from "react-native-paper";
import type { PayMode } from "@paydirt/shared";
import { MINUTES_STEP } from "@paydirt/shared";

// Pay mode + amounts for a chore form: bucks, screen minutes, or both.
export function PayModeFields({
  mode, reward, minutes, onMode, onReward, onMinutes, currencyName,
}: {
  mode: PayMode;
  reward: string;
  minutes: string;
  onMode: (m: PayMode) => void;
  onReward: (v: string) => void;
  onMinutes: (v: string) => void;
  currencyName: string;
}) {
  const theme = useTheme();
  return (
    <View style={styles.wrap}>
      <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>Pays</Text>
      <SegmentedButtons
        value={mode}
        onValueChange={(v) => onMode(v as PayMode)}
        density="small"
        buttons={[
          { value: "bucks", label: currencyName },
          { value: "time", label: "Time" },
          { value: "both", label: "Both" },
        ]}
      />
      {mode !== "time" && (
        <TextInput mode="outlined" label={`Reward (${currencyName})`} value={reward} onChangeText={onReward}
          keyboardType="numeric" dense style={styles.input} />
      )}
      {mode !== "bucks" && (
        <TextInput mode="outlined" label="Bonus minutes" value={minutes}
          onChangeText={onMinutes} keyboardType="numeric" dense style={styles.input}
          placeholder={`multiples of ${MINUTES_STEP}`} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  input: { width: 200 },
});
