import type { Household } from "./types";

/** Default amount for a parent "Great work" award. */
export const KUDOS_DEFAULT_BUCKS = 100;

/** Server and client cap for an optional kudos reason. */
export const KUDOS_REASON_MAX = 500;

/** Household configuration falls back to the product default when unset. */
export function kudosDefaultBucks(
  household: Pick<Household, "kudos_default_bucks"> | null | undefined,
): number {
  const configured = household?.kudos_default_bucks ?? 0;
  return configured > 0 ? configured : KUDOS_DEFAULT_BUCKS;
}
