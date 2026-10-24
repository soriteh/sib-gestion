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

console.log("Sync conflict safety regression tests passed (6 assertions).");
