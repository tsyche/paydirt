// State machine for the in-app update dialog. Pure so it can be unit-tested;
// App.tsx feeds it native events (PayDirtUpdate{Progress,Ready,Failed}).

export type UpdateState =
  | { phase: "idle" }
  | { phase: "downloading"; percent: number }
  | { phase: "ready" }
  | { phase: "failed"; reason: number };

export type UpdateEvent =
  | { type: "start" }
  | { type: "progress"; percent: number }
  | { type: "ready" }
  | { type: "failed"; reason: number }
  | { type: "dismiss" };

export const IDLE: UpdateState = { phase: "idle" };

export function updateReducer(state: UpdateState, ev: UpdateEvent): UpdateState {
  switch (ev.type) {
    case "start":
      // A second tap while downloading or ready must not restart anything.
      return state.phase === "downloading" || state.phase === "ready" ? state : { phase: "downloading", percent: 0 };
    case "progress":
      if (state.phase !== "downloading") return state;
      return { phase: "downloading", percent: Math.max(0, Math.min(100, Math.round(ev.percent))) };
    case "ready":
      return { phase: "ready" };
    case "failed":
      return { phase: "failed", reason: ev.reason };
    case "dismiss":
      // Closing mid-download only hides the dialog; the download keeps going.
      return state.phase === "failed" ? IDLE : state;
  }
}

// True when the dialog should be on screen. "hidden" is the user's Hide/Later;
// a failure always shows.
export function dialogVisible(state: UpdateState, hidden: boolean): boolean {
  if (state.phase === "idle") return false;
  return state.phase === "failed" || !hidden;
}
