import { formatTime12 } from "./timeRange";

export const DELIVERY_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
export function deliveryDays(value = ""): Record<string, string> {
  try {
    const parsed = JSON.parse(value || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch { return {}; }
}
export function deliverySummary(value: string, inherited = "Use default"): string {
  if (!value) return inherited;
  if (value === "all") return "All day";
  if (value === "none") return "No delivery";
  return value.split(",").map((range) => range.split("-").map(formatTime12).join(" – ")).join(", ");
}
export function setDeliveryDay(value: string, day: number, window: string): string {
  const days = { ...deliveryDays(value) };
  if (window) days[String(day)] = window;
  else delete days[String(day)];
  return JSON.stringify(days);
}
