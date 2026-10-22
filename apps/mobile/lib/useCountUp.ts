import { useEffect, useRef, useState } from "react";
import { Animated, AccessibilityInfo, Easing } from "react-native";

/**
 * Count-up display value. When `enabled` and the value ticks up, eases from the
 * previous number to the new one (XP-style); otherwise (or under reduced
 * motion) jumps straight to the latest. Returns the number to render.
 */
export function useCountUp(value: number, enabled: boolean): number {
  const [shown, setShown] = useState(value);
  const anim = useRef(new Animated.Value(value)).current;
  const prev = useRef(value);
  const reduceMotion = useRef(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((r) => {
      reduceMotion.current = r;
    });
  }, []);

  useEffect(() => {
    const from = prev.current;
    prev.current = value;
    if (!enabled || reduceMotion.current || value <= from) {
      anim.setValue(value);
      setShown(value);
      return;
    }
    anim.setValue(from);
    const listener = anim.addListener(({ value: v }) => setShown(Math.round(v)));
    Animated.timing(anim, {
      toValue: value,
      duration: 900,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(() => anim.removeListener(listener));
    return () => anim.removeListener(listener);
  }, [value, enabled, anim]);

  return shown;
}
