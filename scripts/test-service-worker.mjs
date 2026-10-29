import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("service-worker.js", "utf8");
const htmlSource = readFileSync("index.html", "utf8");
const registerSource = readFileSync("offline-register.js", "utf8");

// SIB Gestion is online-only. The worker must remove the previous offline
// caches and must not intercept fetches or cache application resources.
assert.match(source, /self\.addEventListener\("activate"/);
assert.match(source, /name\.startsWith\("sib-gestion-offline-"\)/);
assert.match(source, /caches\.delete\(name\)/);
assert.doesNotMatch(source, /self\.addEventListener\("fetch"/);
assert.doesNotMatch(source, /caches\.open\(/);
assert.match(source, /self\.addEventListener\("push"/, "Web Push notifications must remain available");
assert.match(source, /self\.addEventListener\("notificationclick"/, "Notification clicks must remain functional");
assert.match(registerSource, /serviceWorker\.register/);
assert.match(registerSource, /uniquement pour les notifications push/);
assert.doesNotMatch(htmlSource, /<link rel="manifest" href="\.\/manifest\.webmanifest">/);
assert.match(htmlSource, /Connexion Internet requise : aucune modification hors ligne n’est enregistrée/);
assert.doesNotMatch(htmlSource, /localStorage\.setItem\("sib-offline-state-v1"/);

console.log("Online-only mode and push-only service worker tests passed.");
