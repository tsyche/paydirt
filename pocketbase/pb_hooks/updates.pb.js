/// <reference path="../pb_data/types.d.ts" />

// Self-hosted expo-updates server (Expo Updates protocol).
// Logic lives in lib/updates.js (required per handler — top-level bindings
// aren't visible inside routerAdd handlers in PocketBase's Goja runtime).

routerAdd("GET", "/api/updates/manifest", (e) => {
  const U = require(`${__hooks}/lib/updates.js`);
  U.handleManifest(e);
});

routerAdd("GET", "/api/updates/assets/{key}", (e) => {
  const U = require(`${__hooks}/lib/updates.js`);
  U.handleAsset(e);
});

routerAdd("GET", "/api/updates/version", (e) => {
  const U = require(`${__hooks}/lib/updates.js`);
  U.handleVersion(e);
});

routerAdd("GET", "/api/updates/apk", (e) => {
  const U = require(`${__hooks}/lib/updates.js`);
  U.handleApk(e);
});

routerAdd("GET", "/api/updates/config", (e) => {
  const U = require(`${__hooks}/lib/updates.js`);
  U.handleConfig(e);
}, $apis.requireSuperuserAuth());
