// Regenerates every icon from assets/paydirt-logo.svg (the Noto Emoji money bag on a
// dirt pile): launcher, splash, favicon, in-app bag, the web
// logo/favicon, and the committed Android mipmaps + notification icons.
// Run: node apps/mobile/scripts/gen-icons.mjs, then bump versionCode.
// android/ is committed and hand-edited (custom Kotlin), so never run
// `expo prebuild` for icons; this script writes the res files directly.
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const here = path.dirname(fileURLToPath(import.meta.url));
const assets = (f) => path.join(here, "..", "assets", f);
const res = (...p) => path.join(here, "..", "android", "app", "src", "main", "res", ...p);
const web = (f) => path.join(here, "..", "..", "web", f);
const GREEN = "#2f7d4f";

const source = await readFile(assets("paydirt-logo.svg"), "utf8");
const bagPng = (size) => sharp(Buffer.from(source), { density: 600 }).resize(size, size).png().toBuffer();

// Bag centred on a size x size transparent canvas, scaled to `fill` of it
// (adaptive-icon layers keep the bag in the centre ~66% safe zone).
const layer = async (size, fill) => {
  const inner = Math.round(size * fill);
  return sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: await bagPng(inner), gravity: "center" }])
    .png()
    .toBuffer();
};
const solid = (size) =>
  sharp({ create: { width: size, height: size, channels: 3, background: GREEN } }).png().toBuffer();
const onGreen = async (size, fill) =>
  sharp(await solid(size)).composite([{ input: await layer(size, fill) }]).png().toBuffer();

// Alpha-only silhouette with the dark-brown $ and tie (#5d4037) cut out.
const mono = async (size, fill) => {
  const { data, info } = await sharp(await layer(size, fill)).raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    const dark = data[i] < 118 && data[i + 1] < 90;
    data[i] = data[i + 1] = data[i + 2] = 0;
    if (dark) data[i + 3] = 0;
  }
  return sharp(data, { raw: info }).png().toBuffer();
};
const white = async (buf) => {
  const { data, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) data[i] = data[i + 1] = data[i + 2] = 255;
  return sharp(data, { raw: info }).png().toBuffer();
};
const roundMask = (size) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}"/></svg>`);

const SAFE = 0.74;
const save = (buf, file) => sharp(buf).png().toFile(file);
const saveWebp = (buf, file) => sharp(buf).webp({ lossless: true }).toFile(file);

const jobs = [
  save(await onGreen(1024, 0.88), assets("icon.png")),
  save(await layer(1024, SAFE), assets("android-icon-foreground.png")),
  save(await solid(1024), assets("android-icon-background.png")),
  save(await mono(432, SAFE), assets("android-icon-monochrome.png")),
  save(await layer(1024, SAFE), assets("splash-icon.png")),
  save(await onGreen(48, 0.95), assets("favicon.png")),
  save(await bagPng(256), assets("bag.png")),
  writeFile(web("public/bag.svg"), source),
];

// Web favicon: bag on a green rounded square (nested copy of the source SVG).
const nested = source.replace(/<\?xml[^>]*\?>/, "").replace(/<!--[\s\S]*?-->/g, "").replace(/<svg[^>]*>/, (tag) => tag.replace(/\s(width|height)="[^"]*"/g, "").replace("<svg", '<svg x="16" y="16" width="96" height="96"'));
jobs.push(
  writeFile(
    web("app/icon.svg"),
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128"><rect width="128" height="128" rx="24" fill="${GREEN}"/>${nested}</svg>\n`,
  ),
);

// Android: adaptive layers at 108dp, legacy launcher at 48dp, notification at 24dp.
const densities = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
for (const [d, scale] of Object.entries(densities)) {
  const m = res(`mipmap-${d}`);
  const n = res(`drawable-${d}`);
  await Promise.all([mkdir(m, { recursive: true }), mkdir(n, { recursive: true })]);
  const adaptive = 108 * scale;
  const legacy = 48 * scale;
  const square = await onGreen(legacy, 0.95);
  const round = await sharp(square).composite([{ input: roundMask(legacy), blend: "dest-in" }]).png().toBuffer();
  jobs.push(
    saveWebp(await layer(adaptive, SAFE), path.join(m, "ic_launcher_foreground.webp")),
    saveWebp(await solid(adaptive), path.join(m, "ic_launcher_background.webp")),
    saveWebp(await mono(adaptive, SAFE), path.join(m, "ic_launcher_monochrome.webp")),
    saveWebp(square, path.join(m, "ic_launcher.webp")),
    saveWebp(round, path.join(m, "ic_launcher_round.webp")),
    save(await white(await mono(24 * scale, 0.9)), path.join(n, "notification_icon.png")),
  );
}

await Promise.all(jobs);
console.log("icons written");
