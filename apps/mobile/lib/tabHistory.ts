// Pure back-stack helpers for the bottom-tab screens: Back returns to the previous tab
// instead of closing the app. Consecutive duplicates are collapsed and the stack is capped.
const MAX_DEPTH = 20;

export function pushTab(stack: string[], current: string, next: string): string[] {
  if (next === current) return stack;
  const out = stack[stack.length - 1] === current ? stack : [...stack, current];
  return out.slice(-MAX_DEPTH);
}

export function popTab(stack: string[]): { stack: string[]; tab: string | null } {
  if (stack.length === 0) return { stack, tab: null };
  return { stack: stack.slice(0, -1), tab: stack[stack.length - 1] };
}
