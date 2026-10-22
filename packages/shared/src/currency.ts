// Currency display naming. `households.currency_name` is per-household
// configurable; when unset the app shows DEFAULT_CURRENCY_NAME instead of the
// old "parentBucks" placeholder. PRESETS are the themed suggestions offered in
// the parent settings UI (Grit is the top pick for the Goldrush identity).

export const DEFAULT_CURRENCY_NAME = "Grit";

export const CURRENCY_PRESETS = ["Grit", "Nuggets", "Gold", "Karats"] as const;

export type CurrencyPreset = (typeof CURRENCY_PRESETS)[number];

/** Display name for a household's currency: trimmed `currency_name`, else the default. */
export function currencyDisplayName(household?: { currency_name?: string } | null): string {
  return household?.currency_name?.trim() || DEFAULT_CURRENCY_NAME;
}
