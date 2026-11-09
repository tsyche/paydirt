import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const mobile = new URL("../", import.meta.url);
const file = (name) => new URL(name, mobile);
const config = JSON.parse(await readFile(file("app.json"), "utf8")).expo;

test("standard launcher artwork is transparent and adaptive backgrounds match configuration", async () => {
  const { data } = await sharp(fileURLToPath(file("assets/icon.png"))).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(data[3], 0, "The launcher corner must not contain a baked-in background");
  const background = await sharp(fileURLToPath(file("assets/android-icon-background.png"))).raw().toBuffer();
  assert.equal(`#${background.subarray(0, 3).toString("hex")}`, config.android.adaptiveIcon.backgroundColor);
});

test("every notification density is a white alpha-only drawable from the dedicated mark", async () => {
  const source = await readFile(file("assets/notification-icon.svg"));
  for (const [density, size] of Object.entries({ mdpi: 24, hdpi: 36, xhdpi: 48, xxhdpi: 72, xxxhdpi: 96 })) {
    const path = fileURLToPath(file(`android/app/src/main/res/drawable-${density}/notification_icon.png`));
    const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    assert.equal(info.width, size);
    assert.equal(info.height, size);
    assert.equal(data[3], 0);
    let visible = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] === 0) continue;
      visible++;
      assert.deepEqual([...data.subarray(i, i + 3)], [255, 255, 255]);
    }
    assert.ok(visible > 0);
    const expected = await sharp(source, { density: 600 }).resize(size, size).ensureAlpha().raw().toBuffer();
    assert.deepEqual(data, expected, `${density} must use the dedicated notification artwork`);
  }
});

test("UnifiedPush and Expo select notification artwork rather than the launcher", async () => {
  const receiver = await readFile(file("android/app/src/main/java/io/paydirt/app/UnifiedPushReceiver.kt"), "utf8");
  assert.doesNotMatch(receiver, /\.setSmallIcon\(R\.mipmap\./, "Android status icons must not use adaptive launcher resources");
  assert.match(receiver, /\.setSmallIcon\(R\.drawable\.notification_icon\)/);
  const plugin = config.plugins.find((entry) => Array.isArray(entry) && entry[0] === "expo-notifications");
  assert.equal(plugin[1].icon, "./assets/notification-icon.png");
  const gradle = await readFile(file("android/app/build.gradle"), "utf8");
  assert.equal(gradle.match(/versionName "([^"]+)"/)[1], config.version);
});
