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


const retryStart = html.indexOf("async function retryPendingCloudSave()");
const retryEnd = html.indexOf("window.addEventListener(\"online\"", retryStart);
assert.ok(retryStart >= 0 && retryEnd > retryStart, "Pending cloud retry handler must exist");
const retry = html.slice(retryStart, retryEnd);
assert.match(retry, /current\.savedAt===pending\.savedAt/,
  "Only the exact snapshot that was sent may be removed from pending storage");
assert.match(retry, /else if\(current\?\.state\)[\s\S]*newerSnapshotPending=true/,
  "A newer snapshot created during an in-flight retry must be detected");
assert.match(retry, /finally\{sibPendingRetryBusy=false;[\s\S]*newerSnapshotPending&&!sibPendingConflict\)schedulePendingCloudRetry\(500\)/,
  "Retry must be scheduled after the current request releases its busy lock");
assert.match(retry, /savedThisSnapshot&&typeof toast/,
  "The success notice must only appear when the pending snapshot was actually cleared");

console.log("Offline authentication and pending-sync regression tests passed.");
