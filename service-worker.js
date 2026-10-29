/* SIB Gestion — service worker réservé aux notifications push, sans cache hors ligne. */
"use strict";

const SCOPE_URL = self.registration.scope;
const urlFor = path => new URL(path, SCOPE_URL).href;

self.addEventListener("install", event => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(
      names
        .filter(name => name.startsWith("sib-gestion-offline-"))
        .map(name => caches.delete(name))
    );
    await self.clients.claim();
  })());
});

// Aucun gestionnaire "fetch" : les pages et ressources doivent venir du réseau.
// Le service worker reste actif uniquement pour préserver les notifications push.
/* Web Push: messages are sent by a configured server-side VAPID dispatcher. */
self.addEventListener("push", event => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; }
  catch (_) { payload = { body: event.data ? event.data.text() : "" }; }
  const title = String(payload.title || "SIB Gestion").slice(0, 120);
  const options = {
    body: String(payload.body || "Vous avez une nouvelle notification.").slice(0, 500),
    icon: urlFor("./icons/sib-icon.svg"),
    badge: urlFor("./icons/sib-icon.svg"),
    tag: String(payload.tag || payload.notification_id || "sib-notification").slice(0, 128),
    data: { url: payload.url || urlFor("./"), notification_id: payload.notification_id || null },
    renotify: false
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || urlFor("./"), SCOPE_URL).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if (client.url.startsWith(SCOPE_URL) && "focus" in client) {
        await client.focus();
        if ("navigate" in client && client.url !== target) await client.navigate(target);
        return;
      }
    }
    if (self.clients.openWindow) await self.clients.openWindow(target);
  })());
});
