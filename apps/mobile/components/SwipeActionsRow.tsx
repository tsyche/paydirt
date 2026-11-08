import { useMemo, useRef, type ReactNode } from "react";
import { Animated, PanResponder, View } from "react-native";
import { Text, useTheme } from "react-native-paper";
import { completesArchiveSwipe, startsArchiveSwipe } from "@paydirt/shared";

/** Left archives; right opens editing where available. Vertical scroll stays free. */
export function SwipeActionsRow({ children, onArchive, onEdit, disabled = false }: {
  children: ReactNode; onArchive: () => void; onEdit?: () => void; disabled?: boolean;
}) {
  const theme = useTheme();
  const offset = useRef(new Animated.Value(0)).current;
  const responder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => !disabled && (g.dx < 0 || !!onEdit) && startsArchiveSwipe(g.dx, g.dy),
    onPanResponderMove: (_, g) => offset.setValue(Math.max(-120, Math.min(onEdit ? 120 : 0, g.dx))),
    onPanResponderRelease: (_, g) => {
      Animated.spring(offset, { toValue: 0, useNativeDriver: false }).start();
      if (disabled || !completesArchiveSwipe(g.dx, g.dy)) return;
      if (g.dx < 0) onArchive();
      else onEdit?.();
    },
    onPanResponderTerminate: () => Animated.spring(offset, { toValue: 0, useNativeDriver: false }).start(),
  }), [disabled, offset, onArchive, onEdit]);
  return <View style={{ overflow: "hidden", borderRadius: 12, marginVertical: 4 }}>
    <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden
      style={{ position: "absolute", inset: 0, backgroundColor: theme.colors.secondaryContainer, flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16 }}>
      <Text>{onEdit ? "Edit" : ""}</Text><Text>Archive</Text>
    </View>
    <Animated.View {...responder.panHandlers} style={{ transform: [{ translateX: offset }], backgroundColor: theme.colors.surface }}>
      {children}
    </Animated.View>
  </View>;
}
