#!/usr/bin/env node
// Grant Family Link bonus screen time via its web API, using a Playwright-held
// Google session (browser-as-auth-container; no UI clicking).
//
// Run with: node --experimental-strip-types scripts/familylink-grant.mjs <command>
//   login            opens your real Chrome on a dedicated profile (NOT your everyday
//                    one) with no automation attached; sign in to the co-parent account
//                    by hand and quit it. The profile is then reopened headless and its
//                    session saved to FL_STATE (chmod 600). Google rejects sign-in in
//                    any automated browser, even real Chrome with a CDP port open.
//   grant <seconds> <childId> <deviceId>
//                    headless; reads the remaining bonus, POSTs remaining + new
//                    seconds from a Family Link page, saves the rotated session
//
// Env: FL_API_KEY (grant only — never commit it),
//      FL_STATE (default ~/.config/paydirt/familylink-state.json),
//      FL_CHROME (Chrome binary; default macOS app path),
//      FL_BROWSER=firefox|chromium to grant with Playwright's own browser builds
//      instead of installed Chrome (the deploy host uses these).
// Exit codes: 0 granted, 2 session expired/missing (run login again), 1 other error.
// Never prints cookies or auth hashes.

import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium, firefox } from "playwright";
import {
  FL_ORIGIN,
  FamilyLinkAuthError,
  addFamilyLinkBonus,
  assertFamilyLinkId,
  buildAuthorization,
  parseGrantSeconds,
} from "../packages/shared/src/familylink.ts";

const statePath = path.resolve(
  process.env.FL_STATE ?? path.join(os.homedir(), ".config/paydirt/familylink-state.json"),
);
const profileDir = path.join(path.dirname(statePath), "chrome-profile");
const chromePath =
  process.env.FL_CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

function launchHeadless() {
  const browser = process.env.FL_BROWSER ?? "chrome";
  if (browser === "firefox") return firefox.launch({ headless: true });
  if (browser === "chromium") return chromium.launch({ headless: true });
  if (browser === "chrome") return chromium.launch({ headless: true, channel: "chrome" });
  throw new Error(`Unknown FL_BROWSER: ${browser} (firefox, chromium, or chrome)`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function saveState(context) {
  fs.mkdirSync(path.dirname(statePath), { recursive: true, mode: 0o700 });
  await context.storageState({ path: statePath });
  fs.chmodSync(statePath, 0o600);
}

const hasSapisid = (cookies) => cookies.some((c) => c.name === "SAPISID" && c.value);

// Phase 1: plain Chrome, no debugging port (Google flags even an attached CDP
// port as "not secure"). Resolves when the user quits that Chrome instance.
function signInByHand() {
  return new Promise((resolve, reject) => {
    const chrome = spawn(
      chromePath,
      [`--user-data-dir=${profileDir}`, "--no-first-run", FL_ORIGIN],
      { stdio: "ignore" },
    );
    chrome.on("error", reject);
    chrome.on("exit", resolve);
  });
}

// Phase 2: reopen the same profile headless with a loopback debugging port and
// export its session. Real Chrome (not Playwright's launch) so it can decrypt
// the profile's cookies with the macOS Keychain.
async function exportProfileSession() {
  // Port 0 = Chrome picks a free loopback port and writes it to DevToolsActivePort.
  const portFile = path.join(profileDir, "DevToolsActivePort");
  fs.rmSync(portFile, { force: true });
  const chrome = spawn(
    chromePath,
    [`--user-data-dir=${profileDir}`, "--headless=new", "--remote-debugging-port=0", "about:blank"],
    { stdio: "ignore" },
  );
  try {
    let port;
    for (let i = 0; i < 50 && !port; i++) {
      await sleep(200);
      port = fs.existsSync(portFile) && fs.readFileSync(portFile, "utf8").split("\n")[0];
    }
    if (!port) throw new Error("Chrome did not open a debugging port (is that profile still open?)");
    const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
    const context = browser.contexts()[0];
    const page = await context.newPage();
    await page.goto(FL_ORIGIN, { waitUntil: "domcontentloaded" });
    if (new URL(page.url()).origin !== FL_ORIGIN || !hasSapisid(await context.cookies(FL_ORIGIN))) {
      console.error("Not signed in to Family Link in that profile — run login again.");
      return 1;
    }
    await saveState(context);
    console.log(`Session saved to ${statePath}`);
    return 0;
  } finally {
    chrome.kill();
  }
}

async function login() {
  fs.mkdirSync(profileDir, { recursive: true, mode: 0o700 });
  console.log(
    "A separate Chrome window is opening. Sign in to the co-parent account until Family Link\n" +
      "loads, then QUIT that Chrome (Cmd+Q in that window). Your everyday Chrome is untouched.",
  );
  await signInByHand();
  return exportProfileSession();
}

async function grant(rawSeconds, rawChildId, rawDeviceId) {
  const seconds = parseGrantSeconds(rawSeconds);
  const childId = assertFamilyLinkId("childId", rawChildId);
  const deviceId = assertFamilyLinkId("deviceId", rawDeviceId);
  const apiKey = assertFamilyLinkId("apiKey", process.env.FL_API_KEY);
  if (!fs.existsSync(statePath)) {
    throw new FamilyLinkAuthError(`No saved session at ${statePath}`);
  }

  const browser = await launchHeadless();
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
    let res;
    try {
      res = await addFamilyLinkBonus(
        (url, init) =>
          page.evaluate(
            async ({ url, init }) => {
              const r = await fetch(url, {
                ...init,
                credentials: "include",
                ...(init.method === "POST" ? { headers: { "Content-Type": "text/plain" } } : {}),
              });
              return { status: r.status, text: init.method === "GET" ? await r.text() : "" };
            },
            { url, init },
          ),
        { childId, deviceId, apiKey, authorization, seconds },
      );
    } finally {
      await saveState(context);
    }

    console.log(
      `Added ${seconds}s; preserved ${res.remainingSeconds}s; bonus set to ${res.totalSeconds}s (HTTP ${res.status}).`,
    );
    return 0;
  } finally {
    await browser.close();
  }
}

const [cmd, ...args] = process.argv.slice(2);
try {
  if (cmd === "login") process.exitCode = await login();
  else if (cmd === "grant") process.exitCode = await grant(...args);
  else {
    console.error("Usage: familylink-grant.mjs login | grant <seconds> <childId> <deviceId>");
    process.exitCode = 1;
  }
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = err instanceof FamilyLinkAuthError ? 2 : 1;
}
