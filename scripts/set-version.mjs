// Stamps a release version into app.json: `node scripts/set-version.mjs 1.2.3`.
// versionCode must only ever grow, so it is derived from the version itself:
// 1.2.3 → 10203 (room for 99 minors and 99 patches per major).
import { readFileSync, writeFileSync } from "node:fs";

const version = (process.argv[2] ?? "").replace(/^v/, "");
const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
if (!match) {
  console.error(`Not a version: "${process.argv[2]}" (expected 1.2.3 or v1.2.3)`);
  process.exit(1);
}
const [major, minor, patch] = match.slice(1).map(Number);
if (minor > 99 || patch > 99) {
  console.error("minor and patch must stay below 100");
  process.exit(1);
}

const app = JSON.parse(readFileSync("app.json", "utf8"));
app.expo.version = version;
app.expo.android.versionCode = major * 10000 + minor * 100 + patch;
writeFileSync("app.json", `${JSON.stringify(app, null, 2)}\n`);
console.log(`version ${version}, versionCode ${app.expo.android.versionCode}`);
