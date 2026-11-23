import { useState } from "react";
import { View } from "react-native";
import { Button, Text } from "react-native-paper";
import { goalTargetToGrit, type AdjustmentUnit } from "@paydirt/shared";
import { TextInput } from "./TextInput";

/** Goal target entry in Grit or dollars. Reports whole Grit (NaN until valid). */
export function GoalTargetInput({ currencyName, goodsRate, onChange, mode = "flat", style }: {
  currencyName: string; goodsRate: number; onChange: (grit: number) => void;
  mode?: "flat" | "outlined"; style?: object;
}) {
  const [unit, setUnit] = useState<AdjustmentUnit>("grit");
  const [raw, setRaw] = useState("");
  const grit = goalTargetToGrit(Number(raw), unit, goodsRate);
  const update = (nextRaw: string, nextUnit: AdjustmentUnit) => {
    setRaw(nextRaw); setUnit(nextUnit);
    onChange(goalTargetToGrit(Number(nextRaw), nextUnit, goodsRate));
  };
  return <View style={{ gap: 4 }}>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <TextInput
        dense={mode === "flat"} mode={mode === "outlined" ? "outlined" : undefined}
        label={mode === "outlined" ? (unit === "dollars" ? "Target ($)" : `Target (${currencyName})`) : undefined}
        placeholder={unit === "dollars" ? "Cost $" : "Cost"}
        value={raw} onChangeText={(v) => update(v, unit)}
        keyboardType={unit === "dollars" ? "decimal-pad" : "number-pad"} style={style}
      />
      <Button compact mode="outlined" disabled={unit === "grit" && !(goodsRate > 0)}
        accessibilityLabel={unit === "grit" ? "Enter target in dollars" : `Enter target in ${currencyName}`}
        onPress={() => update("", unit === "grit" ? "dollars" : "grit")}>
        {unit === "grit" ? "$" : currencyName}
      </Button>
    </View>
    {unit === "dollars" && Number.isFinite(grit) && <Text variant="bodySmall" accessibilityLiveRegion="polite">
      ≈ {grit} {currencyName} ({goodsRate} per $1)
    </Text>}
  </View>;
}
