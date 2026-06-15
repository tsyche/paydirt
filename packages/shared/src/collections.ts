// Canonical PocketBase collection names. Import these instead of hardcoding
// strings so a rename is a one-line change.

export const Collections = {
  Households: "households",
  Users: "users",
  Chores: "chores",
  Assignments: "assignments",
  CurrencyTransactions: "currency_transactions",
  SpendRequests: "spend_requests",
  Broadcasts: "broadcasts",
  SavingsGoals: "savings_goals",
  ChoreProposals: "chore_proposals",
  ChoreTemplates: "chore_templates",
} as const;

export type CollectionName = (typeof Collections)[keyof typeof Collections];
