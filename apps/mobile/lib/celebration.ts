/**
 * Whether the coin-pop should play for a trigger value. Only a change from the
 * value seen at mount (or last play) counts: the component remounts whenever
 * the parent screen swaps to a detail view and back, and must not replay then.
 */
export function shouldPlayCelebration(lastSeen: number, trigger: number): boolean {
  return trigger > 0 && trigger !== lastSeen;
}
