// Regenerates the launcher icon, splash, favicon and monochrome PNGs from the
// original money-bag drawing below. Run: node apps/mobile/scripts/gen-icons.mjs
// android/ is committed and hand-edited (custom Kotlin), so `expo prebuild`
// would wipe it: run prebuild, keep ONLY res/mipmap-*/ic_launcher*.webp,
// res/drawable-*/notification_icon.png and values/colors.xml iconBackground,
// then `git checkout`/`git clean` the rest of android/. Bump versionCode.
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { writeFile } from "node:fs/promises";

const here = path.dirname(fileURLToPath(import.meta.url));
const out = (f) => path.join(here, "..", "assets", f);
const webOut = (f) => path.join(here, "..", "..", "web", f);
const GREEN = "#2f7d4f";
const GOLD = "#f5b82e";
const GOLD_DARK = "#b8801a";
const INK = "#1f5a38";

// 1024x1024 canvas; the bag sits inside the centre ~66% (Android safe zone).
const BODY = "M400 330C250 450 200 620 300 740C400 830 624 830 724 740C824 620 774 450 624 330Z";
const RUFFLE = "M400 305L345 205Q512 275 679 205L624 305Z";
const BAND = "M388 305H636V350Q512 372 388 350Z";
const DOLLAR =
  "M582 525C560 478 448 482 448 540C448 598 578 578 578 642C578 700 462 700 440 652M512 462V718";

const bag = (fill, stroke, dollar) => `
  <g stroke-linejoin="round" stroke-linecap="round">
    <path d="${BODY}" fill="${fill}" stroke="${stroke}" stroke-width="14"/>
    <path d="${RUFFLE}" fill="${fill}" stroke="${stroke}" stroke-width="14"/>
    <path d="${BAND}" fill="${stroke}"/>
    ${dollar}
  </g>`;
const colorDollar = `<path d="${DOLLAR}" fill="none" stroke="${INK}" stroke-width="38"/>`;
const svg = (inner, bg = "") =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">${bg}${inner}</svg>`;

const color = bag(GOLD, GOLD_DARK, colorDollar);
// Monochrome: alpha-only silhouette with the $ cut out via a mask.
const mono = `
  <mask id="m"><rect width="1024" height="1024" fill="#000"/>
    <g fill="#fff" stroke="#fff" stroke-width="14" stroke-linejoin="round"><path d="${BODY}"/><path d="${RUFFLE}"/><path d="${BAND}"/></g>
    <path d="${DOLLAR}" fill="none" stroke="#000" stroke-width="38" stroke-linecap="round" stroke-linejoin="round"/>
  </mask>
  <rect width="1024" height="1024" fill="#000" mask="url(#m)"/>`;
const bgRect = `<rect width="1024" height="1024" fill="${GREEN}"/>`;

const render = (s, size, file, flatten) => {
  let p = sharp(Buffer.from(s), { density: 144 }).resize(size, size);
  if (flatten) p = p.flatten({ background: GREEN }).removeAlpha();
  return p.png().toFile(out(file));
};

await Promise.all([
  render(svg(color, bgRect), 1024, "icon.png", true),
  render(svg(color), 1024, "android-icon-foreground.png"),
  render(svg("", bgRect), 1024, "android-icon-background.png"),
  render(svg(mono), 432, "android-icon-monochrome.png"),
  render(svg(color), 1024, "splash-icon.png"),
  render(svg(color, bgRect), 48, "favicon.png"),
  // In-app logo mark (transparent), shared look with the launcher icon.
  render(svg(color), 256, "bag.png"),
  writeFile(webOut("public/bag.svg"), svg(color)),
  writeFile(webOut("app/icon.svg"), svg(color, bgRect)),
]);
console.log("icons written");
