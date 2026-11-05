import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync("index.html", "utf8");
const backupStart = html.indexOf("function downloadPendingCloudBackup()");
const backupEnd = html.indexOf("function isCloudVersionConflict", backupStart);
assert.ok(backupStart >= 0 && backupEnd > backupStart, "Backup download handler must exist");
const backup = html.slice(backupStart, backupEnd);
assert.match(backup, /sib-conflict-backup-v1/,
  "The recovery downloader must be able to read the archived local snapshot");
assert.doesNotMatch(backup, /localStorage\.removeItem\(SIB_PENDING_KEY\)/,
  "Downloading a backup must not delete pending data");

const bootStart = html.indexOf("async function boot(){");
const bootEnd = html.indexOf("const info=", bootStart);
assert.ok(bootStart >= 0 && bootEnd > bootStart, "Boot flow must exist");
const boot = html.slice(bootStart, bootEnd);
assert.match(boot, /if\(remote\?\.state\)[\s\S]*Supabase is the single source of truth/,
  "Central Supabase state must be authoritative when available");
assert.match(boot, /localStorage\.setItem\("sib-conflict-backup-v1",JSON\.stringify\(archive\)\)[\s\S]*localStorage\.removeItem\(SIB_PENDING_KEY\)/,
  "A differing local snapshot must be archived before it is removed from the automatic retry queue");
assert.doesNotMatch(boot, /sibPendingConflict=true/,
  "An archived stale snapshot must not keep the application blocked");
assert.match(boot, /Données centrales sont actives\. Une copie de sécurité/,
  "The user must be informed that central data is active and a recovery copy exists");

const retryStart = html.indexOf("async function retryPendingCloudSave()");
const retryEnd = html.indexOf("window.addEventListener("online", retryStart);
assert.ok(retryStart >= 0 && retryEnd > retryStart, "Pending cloud retry handler must exist");
const retry = html.slice(retryStart, retryEnd);
assert.match(retry, /current\.savedAt===pending\.savedAt/,
  "Only the exact snapshot that was sent may be removed from pending storage");
assert.match(retry, /newerSnapshotPending=true/,
  "A newer snapshot created during an in-flight retry must be detected");

console.log("Online-first synchronization regression tests passed.");
