/// <reference path="../pb_data/types.d.ts" />

// Self-hosted expo-updates server (Expo Updates protocol).
//
// Normal update responses are plain application/json (the Android FileDownloader
// parses a non-multipart body as a manifest — see expo-updates FileDownloader.kt).
// Directives (rollBackToEmbedded / noUpdateAvailable) still require protocol v1
// and a multipart/mixed response with a single "directive" part.
//
// Layout written by `just update-publish`:
//   pb_data/updates/<runtimeVersion>/<epochMillis>/
//     manifest.json   — our server-side record (see scripts/publish-update.mjs)
//     metadata.json   — expo export metadata.json (platform → {bundle, assets[]})
//     expoConfig.json — app config at export time
//     assets/         — md5-named files (launch asset ends in .bundle)
//   Newest epoch directory wins. `just update-rollback` drops a `rollback`
//   marker into that directory; clients on protocol v1 then get a
//   rollBackToEmbedded directive until a newer update is published.
//
// Endpoints (public — the update client is unauthenticated):
//   GET /api/updates/manifest   — latest manifest for expo-runtime-version
//   GET /api/updates/assets/{k} — asset file by md5 key (immutable cache)
//   GET /api/updates/config     — superuser-only: latest per-runtime config (debug)

const UPDATES_ROOT = $os.getenv("PAYDIRT_UPDATES_DIR") || "pb_data/updates";

function mimeForExt(ext) {
  const map = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    ttf: "font/ttf",
    otf: "font/otf",
    woff: "font/woff",
    woff2: "font/woff2",
    hbc: "application/octet-stream",
    bundle: "application/javascript",
    js: "application/javascript",
    json: "application/json",
  };
  return map[(ext || "").toLowerCase()] || "application/octet-stream";
}

function headerOr(e, name, fallback) {
  const v = e.request.header.get(name);
  if (v === null || v === undefined || v === "") return fallback || "";
  if (Array.isArray(v)) return v.length > 0 ? String(v[0]) : fallback || "";
  return String(v);
}

function readTextFile(path) {
  const raw = $os.readFile(path);
  if (typeof raw === "string") return raw;
  return String.fromCharCode.apply(null, raw);
}

function readBytesFile(path) {
  const raw = $os.readFile(path);
  if (typeof raw === "string") return Array.from(new TextEncoder().encode(raw));
  return raw;
}

function tryReadText(path) {
  try {
    return readTextFile(path);
  } catch (_) {
    return null;
  }
}

function fileExists(path) {
  try {
    $os.readFile(path);
    return true;
  } catch (_) {
    return false;
  }
}

function listUpdateDirs(runtimeVersion) {
  const versionRoot = UPDATES_ROOT + "/" + runtimeVersion;
  let entries;
  try {
    entries = $os.readDir(versionRoot);
  } catch (_) {
    return [];
  }
  return entries
    .filter((en) => en.isDir())
    .map((en) => en.name())
    .sort((a, b) => (parseInt(b, 10) || 0) - (parseInt(a, 10) || 0));
}

function newestUpdateDir(runtimeVersion) {
  const dirs = listUpdateDirs(runtimeVersion);
  if (dirs.length === 0) return null;
  return UPDATES_ROOT + "/" + runtimeVersion + "/" + dirs[0];
}

function setUpdateHeaders(e, protocolVersion) {
  const h = e.response.header();
  h.set("Expo-Protocol-Version", String(protocolVersion));
  h.set("Expo-Sfv-Version", "0");
  h.set("Cache-Control", "private, max-age=0");
}

function multipartBytes(boundary, name, body) {
  const enc = new TextEncoder();
  const head = enc.encode(
    "--" + boundary + "\r\n" +
    'Content-Disposition: form-data; name="' + name + '"\r\n' +
    "Content-Type: application/json\r\n\r\n"
  );
  const mid = enc.encode(body);
  const tail = enc.encode("\r\n--" + boundary + "--\r\n");
  const out = new Uint8Array(head.length + mid.length + tail.length);
  out.set(head, 0);
  out.set(mid, head.length);
  out.set(tail, head.length + mid.length);
  return Array.from(out);
}

function respondDirective(e, directive, protocolVersion) {
  setUpdateHeaders(e, protocolVersion);
  const boundary = "paydirt-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
  const body = multipartBytes(boundary, "directive", JSON.stringify(directive));
  e.response.header().set("Content-Type", "multipart/mixed; boundary=" + boundary);
  e.blob(200, "multipart/mixed; boundary=" + boundary, body);
}

function respondNoUpdate(e, protocolVersion) {
  // Protocol v1 allows 204 to mean "nothing to do" (see FileDownloader.kt).
  setUpdateHeaders(e, protocolVersion);
  e.response.header().set("Cache-Control", "private, max-age=0");
  e.json(204, {});
}

function respondManifest(e, meta, runtimeVersion, protocolVersion) {
  setUpdateHeaders(e, protocolVersion);
  const proto = e.isTLS() ? "https" : "http";
  const host = e.request.host || headerOr(e, "Host", "");
  const base = proto + "://" + host + "/api/updates/assets/";

  const manifest = {
    id: meta.id,
    createdAt: meta.createdAt,
    runtimeVersion: runtimeVersion,
    launchAsset: {
      hash: meta.launchAsset.hash,
      key: meta.launchAsset.key,
      contentType: "application/javascript",
      url: base + meta.launchAsset.key,
    },
    assets: meta.assets.map((a) => ({
      hash: a.hash,
      key: a.key,
      contentType: a.contentType || "application/octet-stream",
      url: base + a.key,
    })),
    metadata: {},
    extra: {},
  };
  e.json(200, manifest);
}

routerAdd("GET", "/api/updates/manifest", (e) => {
  const protocolVersion = parseInt(headerOr(e, "Expo-Protocol-Version", "0"), 10) || 0;
  const platform = headerOr(e, "Expo-Platform", "");
  const runtimeVersion = headerOr(e, "Expo-Runtime-Version", "");
  const currentUpdateId = headerOr(e, "Expo-Current-Update-Id", "");
  const embeddedUpdateId = headerOr(e, "Expo-Embedded-Update-Id", "");

  if (platform !== "android" && platform !== "ios") {
    e.json(400, { error: "Unsupported platform. Expected ios or android." });
    return;
  }
  if (!runtimeVersion) {
    e.json(400, { error: "No expo-runtime-version header." });
    return;
  }

  const newest = newestUpdateDir(runtimeVersion);
  if (!newest) {
    e.json(404, { error: "No updates for runtime version " + runtimeVersion });
    return;
  }
  const metaText = tryReadText(newest + "/manifest.json");
  if (!metaText) {
    e.json(500, { error: "Corrupt update: missing manifest.json" });
    return;
  }
  let meta;
  try {
    meta = JSON.parse(metaText);
  } catch (_) {
    e.json(500, { error: "Corrupt update: manifest.json is not valid JSON" });
    return;
  }

  // Rollback marker: rollBackToEmbedded (protocol v1 only).
  if (fileExists(newest + "/rollback")) {
    if (protocolVersion < 1) {
      e.json(406, { error: "Rollbacks require protocol version 1." });
      return;
    }
    if (currentUpdateId && embeddedUpdateId && currentUpdateId === embeddedUpdateId) {
      respondNoUpdate(e, 1);
      return;
    }
    respondDirective(
      e,
      {
        type: "rollBackToEmbedded",
        parameters: { commitTime: new Date(parseInt(newest.split("/").pop(), 10)).toISOString() },
      },
      1
    );
    return;
  }

  // Client already on this exact update: 204 on protocol v1 avoids re-download.
  if (protocolVersion >= 1 && currentUpdateId && currentUpdateId === meta.id) {
    respondNoUpdate(e, 1);
    return;
  }

  respondManifest(e, meta, runtimeVersion, protocolVersion);
});

routerAdd("GET", "/api/updates/assets/{key}", (e) => {
  const key = e.request.pathValue("key") || "";
  // Key is md5 hex (+ optional .ext) from the publish script — reject anything else.
  if (!/^[a-f0-9]{32}(\.[A-Za-z0-9]+)?$/.test(key)) {
    e.json(400, { error: "Bad asset key." });
    return;
  }
  let verEntries;
  try {
    verEntries = $os.readDir(UPDATES_ROOT);
  } catch (_) {
    e.json(404, { error: "No updates published." });
    return;
  }
  for (const ver of verEntries) {
    if (!ver.isDir()) continue;
    let epochs;
    try {
      epochs = $os.readDir(UPDATES_ROOT + "/" + ver.name());
    } catch (_) {
      continue;
    }
    for (const d of epochs) {
      if (!d.isDir()) continue;
      const path = UPDATES_ROOT + "/" + ver.name() + "/" + d.name() + "/assets/" + key;
      if (!fileExists(path)) continue;
      const bytes = readBytesFile(path);
      const dot = key.lastIndexOf(".");
      const ext = dot > -1 ? key.slice(dot + 1) : "";
      e.response.header().set("Cache-Control", "public, max-age=31536000, immutable");
      e.blob(200, mimeForExt(ext), bytes);
      return;
    }
  }
  e.json(404, { error: "Asset not found." });
});

// Superuser-only debug: what would the next manifest request serve?
routerAdd("GET", "/api/updates/config", $apis.requireSuperuserAuth((e) => {
  const runtimeVersion = e.query.get("runtimeVersion") || "";
  if (!runtimeVersion) {
    e.json(400, { error: "runtimeVersion query param required." });
    return;
  }
  const newest = newestUpdateDir(runtimeVersion);
  if (!newest) {
    e.json(404, { error: "No updates for runtime version." });
    return;
  }
  const metaText = tryReadText(newest + "/manifest.json");
  const meta = metaText ? JSON.parse(metaText) : null;
  e.json(200, {
    path: newest,
    hasRollback: fileExists(newest + "/rollback"),
    manifest: meta,
  });
}));
