"use client";

import { useEffect } from "react";
import { pollGrantResults } from "@paydirt/shared";
import { client } from "./client";

/** The cron remains recovery; visible queued grants catch up within five seconds. */
export function useGrantStatusRefresh(queued: number, reload: () => Promise<void>): void {
  useEffect(() => {
    if (!queued) return;
    let live = true;
    const stop = pollGrantResults(async () => {
      const result = await client.refreshGrantResults();
      if (live && (result.changed || result.queued !== queued)) await reload();
    }, () => document.visibilityState === "visible");
    return () => { live = false; stop(); };
  }, [queued, reload]);
}
