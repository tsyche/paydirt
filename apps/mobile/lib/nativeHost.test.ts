import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("selects Metro versus the embedded bundle using the app build variant", () => {
  const source = readFileSync(new URL("../android/app/src/main/java/io/paydirt/app/MainApplication.kt", import.meta.url), "utf8");
  const factory = source.slice(source.indexOf("ExpoReactHostFactory.getDefaultReactHost("), source.indexOf("override fun onCreate"));
  // Expo's factory defaults to the React library's DEBUG value, not this APK's.
  expect(factory).toMatch(/useDevSupport\s*=\s*BuildConfig\.DEBUG/);
});
