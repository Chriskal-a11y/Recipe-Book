// Keeps the app working offline. Bump VERSION whenever recipes or the app change.
const VERSION = "v13";
const FILES = ["./", "index.html", "style.css", "app.js", "recipes.js", "sync.js", "photos.js", "config.js", "vendor/supabase-2.118.0.js", "manifest.json", "icons/icon-192.png", "icons/icon-512.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES.map(f => new Request(f, { cache: "reload" }))))); self.skipWaiting(); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k))))); self.clients.claim(); });
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  // Network first, so updates arrive when online; cached copy when offline.
  // Same-site files skip the browser cache, so a new version shows up right away.
  const same = new URL(e.request.url).origin === location.origin;
  e.respondWith(fetch(e.request, same ? { cache: "no-cache" } : undefined).then(r => { const copy = r.clone(); if (r.ok || r.type === "opaque") caches.open(VERSION).then(c => c.put(e.request, copy)); return r; })
    .catch(() => caches.match(e.request).then(m => m || caches.match("index.html"))));
});
