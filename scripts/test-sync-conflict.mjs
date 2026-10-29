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
assert.match(boot, /Connexion Internet requise : SIB Gestion ne fonctionne pas hors ligne/);
assert.match(boot, /Les modifications locales antérieures en attente sont conservées/);
assert.doesNotMatch(boot, /sib-offline-profile-v1/,
  "Cached profile must not be used as an offline identity");
assert.doesNotMatch(boot, /sib-offline-state-v1/,
  "Cached application state must not be used for offline access");
assert.match(boot, /if\(remote\?\.state\)[\s\S]*const sameAsCentral=JSON\.stringify\(pendingCloud\.state\)===JSON\.stringify\(remote\.state\)/,
  "When central state is available, the app must compare it with the pending local snapshot");
assert.match(boot, /if\(sameAsCentral\)[\s\S]*localStorage\.removeItem\(SIB_PENDING_KEY\)/,
  "A pending snapshot may only be removed automatically when it exactly matches central state");
assert.match(boot, /A pending snapshot may contain the most recent edit[\s\S]*NEVER discard the pending record/,
  "A differing pending snapshot must be retained because it may contain an interrupted recent edit");
assert.match(boot, /sibPendingConflict=true[\s\S]*Données centrales chargées\. Une sauvegarde locale différente est conservée/,
  "A differing local snapshot must block writes and notify the user while central state remains displayed");


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
