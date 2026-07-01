const CACHE_NAME = "campaign-engine-shell-v16";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css?v=11",
  "./workspace.css?v=1",
  "./systems/pf2e/styles.css?v=1",
  "./app.js?v=14",
  "./archivist-merge.js?v=2",
  "./features.js?v=9",
  "./systems/registry.js?v=1",
  "./systems/dnd5e/definition.js?v=1",
  "./systems/pf2e/definition.js?v=1",
  "./systems/pf2e/toolkit.js?v=1",
  "./systems/wfrp4e/definition.js?v=1",
  "./systems/blades-in-the-dark/definition.js?v=1",
  "./systems/call-of-cthulhu/definition.js?v=1",
  "./systems/custom/definition.js?v=1",
  "./systems/campaign-system-state.js?v=1",
  "./archivist-data.js",
  "./archivist-details.js",
  "./manifest.webmanifest",
  "./icon.svg"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).catch(() => caches.match("./index.html")));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request)));
});
