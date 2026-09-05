const CACHE_NAME = "campaign-engine-shell-v32";
const APP_SHELL = [
  "./",
  "./index.html",
  "./workspace-persistence.js?v=1",
  "./campaign-history.js?v=1",
  "./campaign-search.js?v=1",
  "./source-library.js?v=1",
  "./workspace-views.js?v=1",
  "./bootstrap.js?v=1",
  "./vendor/pdfjs/pdf.mjs",
  "./vendor/pdfjs/pdf.worker.mjs",
  "./styles.css?v=19",
  "./workspace.css?v=2",
  "./systems/pf2e/styles.css?v=1",
  "./app.js?v=29",
  "./campaign-knowledge.js?v=1",
  "./archivist-merge.js?v=4",
  "./campaign-cleanup.js?v=1",
  "./session-workflow.js?v=1",
  "./foundry-api-bridge.js?v=6",
  "./foundry-live-actions.js?v=2",
  "./foundry-actor-normalizer.js?v=1",
  "./character-filters.js?v=2",
  "./features.js?v=12",
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
  event.waitUntil(Promise.all([caches.open(CACHE_NAME), fetch("./vendor/pdfjs/assets.json").then(response => {
    if (!response.ok) throw new Error("PDF assets are not prepared.");
    return response.json();
  })]).then(([cache, pdfAssets]) => cache.addAll([...new Set([...APP_SHELL, ...pdfAssets])])).then(() => self.skipWaiting()));
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
