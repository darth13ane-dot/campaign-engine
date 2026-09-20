const CACHE_NAME = "campaign-engine-shell-v42";
const APP_SHELL = [
  "./",
  "./index.html",
  "./workspace-schema.js?v=1",
  "./browser-workspace-store.js?v=1",
  "./workspace-persistence.js?v=4",
  "./workspace-entry.js?v=2",
  "./workspace-entry.css?v=1",
  "./campaign-history.js?v=2",
  "./campaign-search.js?v=3",
  "./source-library.js?v=1",
  "./workspace-views.js?v=6",
  "./bootstrap.js?v=4",
  "./vendor/fonts/fonts.css",
  "./vendor/pdfjs/pdf.mjs",
  "./vendor/pdfjs/pdf.worker.mjs",
  "./styles.css?v=20",
  "./workspace.css?v=4",
  "./systems/pf2e/styles.css?v=1",
  "./app.js?v=38",
  "./campaign-knowledge.js?v=1",
  "./archivist-merge.js?v=5",
  "./campaign-cleanup.js?v=1",
  "./session-prep.js?v=5",
  "./session-prep-views.js?v=6",
  "./session-prep.css?v=3",
  "./session-workflow.js?v=5",
  "./prep-continuity.js?v=2",
  "./prep-continuity-views.js?v=2",
  "./prep-continuity.css?v=1",
  "./player-packet.js?v=2",
  "./player-preview.js?v=2",
  "./player-packet-views.js?v=2",
  "./player-packet.css?v=1",
  "./prep-template-starters.js?v=1",
  "./prep-templates.js?v=1",
  "./prep-template-views.js?v=2",
  "./prep-template.css?v=1",
  "./prep-notes.js?v=1",
  "./prep-notes-views.js?v=1",
  "./prep-notes.css?v=1",
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
  const manifests = ["./vendor/pdfjs/assets.json", "./vendor/fonts/assets.json"];
  event.waitUntil(Promise.all([caches.open(CACHE_NAME), ...manifests.map(url => fetch(url).then(response => {
    if (!response.ok) throw new Error("Local PDF or font assets are not prepared.");
    return response.json();
  }))]).then(([cache, ...assetLists]) => cache.addAll([...new Set([...APP_SHELL, ...manifests, ...assetLists.flat()])])).then(() => self.skipWaiting()));
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
