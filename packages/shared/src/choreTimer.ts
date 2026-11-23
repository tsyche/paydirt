import type { Assignment } from "./types";

/** Compare recorded submission time, not today's clock, when reviewing proof. */
export function timerEvidence(assignment: Pick<Assignment, "timer_minutes" | "timer_started_at" | "completed_at">): string {
  if (!assignment.timer_minutes) return "";
  if (!assignment.timer_started_at) return "Timer not used";
  const start = new Date(assignment.timer_started_at.replace(" ", "T")).getTime();
  const end = assignment.completed_at ? new Date(assignment.completed_at.replace(" ", "T")).getTime() : NaN;
  return Number.isFinite(start) && end >= start + assignment.timer_minutes * 60000 ? "Timer completed" : "Timer incomplete";
}
