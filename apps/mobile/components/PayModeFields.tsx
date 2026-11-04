import { View, StyleSheet } from "react-native";
import { HelperText, SegmentedButtons, Text, TextInput, useTheme } from "react-native-paper";
import type { PayMode } from "@paydirt/shared";
import { MINUTES_STEP, MAX_REWARD_MINUTES, validatePay } from "@paydirt/shared";

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
  const minuteError = mode !== "bucks" && minutes.trim()
    ? validatePay({ pay_mode: "time", reward_minutes: Number(minutes) })
    : null;
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
        <View>
        <TextInput mode="outlined" label="Bonus minutes" value={minutes}
          onChangeText={onMinutes} keyboardType="numeric" dense style={styles.input}
          error={!!minuteError}
          placeholder={`multiples of ${MINUTES_STEP}`} />
        <HelperText type={minuteError ? "error" : "info"} visible accessibilityLiveRegion="polite">
          {minuteError || `Minimum ${MINUTES_STEP} minutes; use ${MINUTES_STEP}-minute steps, up to ${MAX_REWARD_MINUTES}.`}
        </HelperText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  input: { width: 200 },
});
