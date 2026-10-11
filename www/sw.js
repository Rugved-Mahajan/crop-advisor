const CACHE = "crop-advisor-v1";
const FILES = ["./", "index.html", "app.js", "engine.js", "model.js", "manifest.webmanifest", "icon-192.png", "icon-512.png"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((x) => x !== CACHE).map((x) => caches.delete(x))))); self.clients.claim(); });
self.addEventListener("fetch", (e) => { e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request))); });
