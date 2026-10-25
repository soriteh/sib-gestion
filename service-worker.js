/* SIB Gestion offline support — GitHub Pages subpath safe. */
"use strict";

const VERSION = "sib-gestion-offline-v5";
const SCOPE_URL = self.registration.scope;
const urlFor = path => new URL(path, SCOPE_URL).href;

// Local application resources are required for a reliable offline shell.
// Third-party assets are optional because their availability must not prevent
// the local application shell from being installed.
const REQUIRED_SHELL = [
  "./",
  "./index.html",
  "./supabase-config.js",
  "./supabase-client.js",
  "./manifest.webmanifest",
  "./icons/sib-icon.svg"
];
const OPTIONAL_SHELL = [
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"
];

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    for (const path of REQUIRED_SHELL) {
      const url = urlFor(path);
      // Do not silently report an installed worker if a required local asset
      // cannot be cached; otherwise offline startup would be unreliable.
      await cache.add(new Request(url, { cache: "reload" }));
    }
    await Promise.all(OPTIONAL_SHELL.map(async path => {
      try {
        const response = await fetch(new Request(path, { cache: "reload" }));
        if (response && (response.ok || response.type === "opaque")) {
          await cache.put(path, response);
        }
      } catch (error) {
        console.warn("SIB optional offline asset unavailable:", path, error);
      }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(
      names
        .filter(name => name.startsWith("sib-gestion-offline-") && name !== VERSION)
        .map(name => caches.delete(name))
    );
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  const indexUrl = urlFor("./index.html");

  if (request.mode === "navigate" && url.origin === self.location.origin) {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response && response.ok) {
          const cache = await caches.open(VERSION);
          // Always use an absolute URL resolved against the deployed subpath.
          await cache.put(indexUrl, response.clone()).catch(error => {
            console.warn("SIB offline navigation cache update failed:", error);
          });
        }
        return response;
      } catch (_) {
        const cache = await caches.open(VERSION);
        return (await cache.match(request)) ||
          (await cache.match(url.href)) ||
          (await cache.match(indexUrl)) ||
          Response.error();
      }
    })());
    return;
  }

  const isLocal = url.origin === self.location.origin;
  const isApprovedCdn = url.hostname === "cdn.jsdelivr.net" ||
    url.hostname === "fonts.googleapis.com" ||
    url.hostname === "fonts.gstatic.com";
  if (!isLocal && !isApprovedCdn) return;

  event.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const cached = await cache.match(request);
    const update = fetch(request).then(async response => {
      if (response && (response.ok || response.type === "opaque")) {
        await cache.put(request, response.clone()).catch(error => {
          console.warn("SIB offline resource cache update failed:", request.url, error);
        });
      }
      return response;
    });
    if (cached) {
      event.waitUntil(update.catch(() => {}));
      return cached;
    }
    try {
      return await update;
    } catch (_) {
      return Response.error();
    }
  })());
});


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
