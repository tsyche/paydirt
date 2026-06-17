import { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, View, AccessibilityInfo, Easing } from "react-native";

const PARTICLES = ["🪙", "🎉", "⭐", "🪙", "✨"];

/**
 * A quick coin-pop when a chore is approved — the little payoff that makes
 * earning feel good (and that a serious finance app would never do). Plays
 * whenever `trigger` increments. Reduced-motion: shows a brief static burst
 * instead of flinging particles. Tuned to stay tasteful, with room to dial up.
 */
export function Celebration({ trigger }: { trigger: number }) {
  const progress = useRef(new Animated.Value(0)).current;
  const [visible, setVisible] = useState(false);
  const reduceMotion = useRef(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((r) => {
      reduceMotion.current = r;
    });
  }, []);

  useEffect(() => {
    if (!trigger) return;
    setVisible(true);
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: reduceMotion.current ? 400 : 1100,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => setVisible(false));
  }, [trigger, progress]);

  if (!visible) return null;

  return (
    <View pointerEvents="none" style={styles.overlay}>
      {PARTICLES.map((emoji, i) => {
        const spread = (i - (PARTICLES.length - 1) / 2) * 54;
        const rise = reduceMotion.current ? 0 : -120 - Math.abs(spread);
        const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [0, spread] });
        const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [0, rise] });
        const scale = progress.interpolate({ inputRange: [0, 0.25, 1], outputRange: [0.2, 1.2, 0.9] });
        const opacity = progress.interpolate({ inputRange: [0, 0.15, 0.7, 1], outputRange: [0, 1, 1, 0] });
        return (
          <Animated.Text
            key={i}
            style={[styles.particle, { opacity, transform: [{ translateX }, { translateY }, { scale }] }]}
          >
            {emoji}
          </Animated.Text>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },
  particle: { position: "absolute", fontSize: 44 },
});
