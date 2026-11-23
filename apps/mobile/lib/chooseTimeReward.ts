import type { Chore } from "@paydirt/shared";

/**
 * Kids never spend at submission: earned minutes always go to the bank and are
 * spent from there. The server still honours 'use' for legacy submissions.
 */
export function chooseTimeReward(_chore?: Chore): Promise<"bank" | "use" | null> {
  return Promise.resolve("bank");
}
