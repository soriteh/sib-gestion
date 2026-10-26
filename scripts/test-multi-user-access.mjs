import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const client = readFileSync("supabase-client.js", "utf8");
const app = readFileSync("index.html", "utf8");

assert.match(client, /if \(isAdminRole\(membership\.role\)\)\s*\{\s*try\s*\{\s*appState = await loadAppState\(\)/,
  "Only administrator roles may load the shared JSON state");
assert.match(client, /getMembership,\s*isAdminRole,/,
  "The role policy must be available to the app shell");

assert.match(app, /const currentIsAdmin=window\.SIBCloud\.isAdminRole\(current\.membership\.role\)/,
  "Boot must determine whether the session may access shared state");
assert.match(app, /if\(!currentIsAdmin\)\s*\{\s*sibPendingConflict=false;\s*S=D0\(\);\s*\}\s*else\s*\{/,
  "Restricted users must not hydrate from pending/cached administrator data");
assert.match(app, /if\(currentIsAdmin\)localStorage\.setItem\("sib-offline-state-v1"/,
  "Only administrators may cache the shared JSON state");
assert.match(app, /const restrictedCloudUser=!!\(CU\?\.cloud&&window\.SIBCloud\?\.ready&&!window\.SIBCloud\.isAdminRole\(RO\)\)/,
  "Cloud non-admin users must receive the restricted navigation");
assert.match(app, /!\["prof","com"\]\.includes\(v\)/,
  "Restricted users must not open unsupported business modules");
assert.match(app, /if\(CU\?\.cloud&&!window\.SIBCloud\.isAdminRole\(RO\)\)\{\s*\/\/ Restricted members must never attempt to save the shared finance\/HR JSON\./,
  "Restricted users must not write the shared finance/HR state");
assert.match(app, /if\(CU\?\.cloud&&!window\.SIBCloud\.isAdminRole\(RO\)\)\{\s*if\(!navigator\.onLine\)throw new Error\("La modification du profil nécessite une connexion/,
  "Restricted profile updates must use authenticated online persistence");

console.log("Multi-user restricted workspace and shared-state isolation tests passed.");
