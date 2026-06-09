"use client";

import { PaydirtClient } from "@paydirt/shared";

const url =
  process.env.NEXT_PUBLIC_POCKETBASE_URL ?? "http://127.0.0.1:8090";

// Browser singleton — PocketBase persists auth to localStorage by default.
export const client = new PaydirtClient(url);
