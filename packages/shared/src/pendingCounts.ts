/**
 * Number of parent actions waiting, for the Approvals tab badge (web + mobile):
 * chore approvals, spend requests, chore ideas, and time grants that need a
 * manual Family Link step. Queued grants are automatic and not counted.
 */
export function waitingActionCount(input: {
  approvals: readonly unknown[];
  spend: readonly unknown[];
  proposals: readonly unknown[];
  screenGrants: readonly { grant_status?: string }[];
  bonusGrants: readonly { grant_status?: string }[];
}): number {
  const manual = (g: { grant_status?: string }) => g.grant_status === "manual";
  return (
    input.approvals.length +
    input.spend.length +
    input.proposals.length +
    input.screenGrants.filter(manual).length +
    input.bonusGrants.filter(manual).length
  );
}
