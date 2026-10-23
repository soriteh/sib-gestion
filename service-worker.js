/* SIB Gestion offline support — GitHub Pages subpath safe. */
"use strict";
const VERSION = "sib-gestion-offline-v3";
const SHELL = [
  "./",
  "./index.html",
  "./supabase-config.js",
  "./supabase-client.js",
  "./manifest.webmanifest",
  "./icons/sib-icon.svg",
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"
];
self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await Promise.all(SHELL.map(async path => {
      try { await cache.add(new Request(path, {cache:"reload"})); }
      catch (error) { console.warn("SIB offline asset unavailable during install:", path, error); }
    }));
    await self.skipWaiting();
  })());
});
self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith("sib-gestion-") && name !== VERSION).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});
self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (request.mode === "navigate" && url.origin === self.location.origin) {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response && response.ok) {
          const cache = await caches.open(VERSION);
          cache.put("./index.html", response.clone()).catch(() => {});
        }
        return response;
      } catch (_) {
        const cache = await caches.open(VERSION);
        return (await cache.match(request)) || (await cache.match("./index.html")) || Response.error();
      }
    })());
    return;
  }
  if (url.origin === self.location.origin || url.hostname === "cdn.jsdelivr.net" || url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    event.respondWith((async () => {
      const cache = await caches.open(VERSION);
      const cached = await cache.match(request);
      const update = fetch(request).then(response => {
        if (response && (response.ok || response.type === "opaque")) cache.put(request, response.clone()).catch(() => {});
        return response;
      });
      if (cached) { event.waitUntil(update.catch(() => {})); return cached; }
      try { return await update; } catch (_) { return Response.error(); }
    })());
  }
});
