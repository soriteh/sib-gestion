import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync("index.html", "utf8");
const start = html.indexOf("function downloadPendingCloudBackup()");
const end = html.indexOf("function isCloudVersionConflict", start);
assert.ok(start >= 0 && end > start, "Backup download handler must exist");
const backup = html.slice(start, end);

// Downloading is only a safety copy, not permission to discard pending data
// or unlock a stale full-state write after a conflict.
assert.doesNotMatch(backup, /localStorage\.removeItem\(SIB_PENDING_KEY\)/,
  "Backup download must not delete the pending local snapshot");
assert.doesNotMatch(backup, /sibPendingConflict\s*=\s*false/,
  "Backup download must not clear the conflict lock");
assert.match(backup, /Le conflit reste bloqué/,
  "The user must be told that synchronization remains blocked");

const conflictStart = html.indexOf("function stopForCloudConflict");
const conflictEnd = html.indexOf("function schedulePendingCloudRetry", conflictStart);
assert.ok(conflictStart >= 0 && conflictEnd > conflictStart, "Conflict handler must exist");
const conflict = html.slice(conflictStart, conflictEnd);
assert.match(conflict, /pendingIsValid/,
  "Conflict handler must preserve an already-persisted, potentially newer snapshot");
assert.match(conflict, /sibPendingConflict\s*=\s*true/,
  "Conflict handler must stop automatic writes");


const bootStart = html.indexOf("async function boot(){");
const bootEnd = html.indexOf("const info=", bootStart);
assert.ok(bootStart >= 0 && bootEnd > bootStart, "Boot flow must exist");
const boot = html.slice(bootStart, bootEnd);
assert.match(boot, /A cached profile is not an authentication factor/);
assert.match(boot, /Connexion hors ligne bloquée pour protéger les données/);
assert.doesNotMatch(boot, /CU=\{id:cachedUser\.id[\s\S]{0,500}enter\(true\)/,
  "Cached profile alone must never authorize offline entry");
assert.match(boot, /Les données locales en attente sont conservées/);

console.log("Offline authentication safety regression tests passed (4 assertions).");
