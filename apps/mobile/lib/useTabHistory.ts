import { useCallback, useEffect, useRef, useState } from "react";
import { BackHandler } from "react-native";
import { popTab, pushTab } from "./tabHistory";

/** Tab state whose hardware Back / back-swipe returns to the previous tab; exits only from the first. */
export function useTabHistory(initial: string): [string, (next: string) => void] {
  const [tab, setTabState] = useState(initial);
  const tabRef = useRef(initial);
  const stack = useRef<string[]>([]);

  const setTab = useCallback((next: string) => {
    stack.current = pushTab(stack.current, tabRef.current, next);
    tabRef.current = next;
    setTabState(next);
  }, []);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      const r = popTab(stack.current);
      if (r.tab === null) return false;
      stack.current = r.stack;
      tabRef.current = r.tab;
      setTabState(r.tab);
      return true;
    });
    return () => sub.remove();
  }, []);

  return [tab, setTab];
}
