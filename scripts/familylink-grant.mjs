#!/usr/bin/env node
// Grant Family Link bonus screen time via its web API, using a Playwright-held
// Google session (browser-as-auth-container; no UI clicking).
//
// Run with: node --experimental-strip-types scripts/familylink-grant.mjs <command>
//   login            headed browser; sign in to the co-parent Google account by hand,
//                    then the session is saved to FL_STATE (chmod 600)
//   grant <seconds>  headless; loads the session, POSTs batchCreate from inside a
//                    familylink.google.com page, saves the (rotated) session back
//
// Env: FL_CHILD_ID, FL_DEVICE_ID, FL_API_KEY (grant only — never commit these),
//      FL_STATE (default ~/.config/paydirt/familylink-state.json),
//      FL_BROWSER=chrome to use installed Chrome instead of Playwright Firefox.
// Exit codes: 0 granted, 2 session expired/missing (run login again), 1 other error.
// Never prints cookies or auth hashes.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium, firefox } from "playwright";
import {
  FL_ORIGIN,
  FamilyLinkAuthError,
  assertFamilyLinkId,
  buildAuthorization,
  buildGrantBody,
  buildGrantUrl,
  classifyGrantStatus,
  parseGrantSeconds,
} from "../packages/shared/src/familylink.ts";

const statePath = path.resolve(
  process.env.FL_STATE ?? path.join(os.homedir(), ".config/paydirt/familylink-state.json"),
);
const LOGIN_TIMEOUT_MS = 10 * 60 * 1000;

function launch(headless) {
  return process.env.FL_BROWSER === "chrome"
    ? chromium.launch({ headless, channel: "chrome" })
    : firefox.launch({ headless });
}

async function saveState(context) {
  fs.mkdirSync(path.dirname(statePath), { recursive: true, mode: 0o700 });
  await context.storageState({ path: statePath });
  fs.chmodSync(statePath, 0o600);
}

const hasSapisid = (cookies) => cookies.some((c) => c.name === "SAPISID" && c.value);

async function login() {
  const browser = await launch(false);
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(FL_ORIGIN);
    console.log("Sign in to the co-parent Google account in the browser window (10 min timeout)...");
    const deadline = Date.now() + LOGIN_TIMEOUT_MS;
    while (Date.now() < deadline) {
      const onFamilyLink = new URL(page.url()).origin === FL_ORIGIN;
      if (onFamilyLink && hasSapisid(await context.cookies(FL_ORIGIN))) {
        await page.waitForLoadState("networkidle").catch(() => {});
        await saveState(context);
        console.log(`Session saved to ${statePath}`);
        return 0;
      }
      await page.waitForTimeout(2000);
    }
    console.error("Timed out waiting for sign-in.");
    return 1;
  } finally {
    await browser.close();
  }
}

async function grant(rawSeconds) {
  const seconds = parseGrantSeconds(rawSeconds);
  const childId = assertFamilyLinkId("childId", process.env.FL_CHILD_ID);
  const deviceId = assertFamilyLinkId("deviceId", process.env.FL_DEVICE_ID);
  const apiKey = assertFamilyLinkId("apiKey", process.env.FL_API_KEY);
  if (!fs.existsSync(statePath)) {
    throw new FamilyLinkAuthError(`No saved session at ${statePath}`);
  }

  const browser = await launch(true);
  try {
    const context = await browser.newContext({ storageState: statePath });
    const page = await context.newPage();
    await page.goto(FL_ORIGIN, { waitUntil: "domcontentloaded" });
    if (new URL(page.url()).origin !== FL_ORIGIN) {
      throw new FamilyLinkAuthError("Redirected away from Family Link — session expired");
    }

    const authorization = buildAuthorization(
      await context.cookies(FL_ORIGIN),
      FL_ORIGIN,
      Math.floor(Date.now() / 1000),
    );
    const url = buildGrantUrl(childId, apiKey, authorization);
    const body = buildGrantBody(childId, deviceId, seconds);
    const res = await page.evaluate(
      async ({ url, body }) => {
        const r = await fetch(url, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "text/plain" },
          body,
        });
        return { status: r.status, text: (await r.text()).slice(0, 300) };
      },
      { url, body },
    );
    await saveState(context);

    const outcome = classifyGrantStatus(res.status);
    if (outcome === "ok") {
      console.log(`Granted ${seconds}s (HTTP ${res.status}).`);
      return 0;
    }
    if (outcome === "auth") throw new FamilyLinkAuthError(`HTTP ${res.status} — session rejected`);
    console.error(`Grant failed: HTTP ${res.status} ${res.text}`);
    return 1;
  } finally {
    await browser.close();
  }
}

const [cmd, arg] = process.argv.slice(2);
try {
  if (cmd === "login") process.exitCode = await login();
  else if (cmd === "grant") process.exitCode = await grant(arg);
  else {
    console.error("Usage: familylink-grant.mjs login | grant <seconds>");
    process.exitCode = 1;
  }
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = err instanceof FamilyLinkAuthError ? 2 : 1;
}
