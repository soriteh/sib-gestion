import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("service-worker.js", "utf8");

// Guard the specific regression found during the offline audit: relative
// cache keys must be resolved against the deployed GitHub Pages subpath.
assert.match(source, /const urlFor = path => new URL\(path, SCOPE_URL\)\.href/);
assert.match(source, /const indexUrl = urlFor\("\.\/index\.html"\)/);
assert.match(source, /cache\.put\(indexUrl, response\.clone\(\)\)/);
assert.match(source, /cache\.match\(indexUrl\)/);

// Local shell resources must be required; the CDN bundle remains optional so
// an external network issue cannot prevent installation of the offline shell.
const required = source.match(/const REQUIRED_SHELL = \[([\s\S]*?)\]/)?.[1] || "";
for (const asset of ["./index.html", "./supabase-config.js", "./supabase-client.js", "./manifest.webmanifest"]) {
  assert.ok(required.includes(JSON.stringify(asset)), `Required offline asset missing: ${asset}`);
}
assert.match(source, /const OPTIONAL_SHELL = \[/);
assert.match(source, /await self\.skipWaiting\(\)/);
assert.match(source, /await self\.clients\.claim\(\)/);
assert.match(source, /sib-gestion-offline-/);

console.log("Service worker offline cache regression tests passed (8 assertions).");
