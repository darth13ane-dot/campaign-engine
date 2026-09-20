/* Start after all feature views and handlers are registered. */
document.querySelector("#reloadSavedWorkspace").addEventListener("click", () => reloadBrowserWorkspace());
document.querySelector("#downloadUnsavedWorkspace").addEventListener("click", () => {
  if (playerPreviewActive() || DESKTOP_API) return;
  try { downloadBrowserWorkspace(); showToast("Current workspace downloaded, including unsaved changes."); }
  catch (error) { showToast(`Workspace download failed: ${error.message}`); }
});
if ("serviceWorker" in navigator && ["http:", "https:"].includes(location.protocol)) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./service-worker.js").catch(() => {
    showToast("Offline caching is unavailable. Keep this page connected or use the Windows app.");
  }));
}
DESKTOP_API?.onExternalLinkError?.(message => showToast(message));
DESKTOP_API?.onPrepareToClose?.(async () => {
  document.querySelector(".app-shell").inert = true;
  try { await workspaceSaver.flush(); DESKTOP_API.finishClose({ ok: true }); }
  catch (error) { document.querySelector(".app-shell").inert = false; DESKTOP_API.finishClose({ ok: false, error: error.message }); }
});
if (!DESKTOP_API) {
  window.addEventListener("pagehide", () => { workspaceSaver.flush().catch(() => {}); });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") workspaceSaver.flush().catch(() => {}); });
  window.addEventListener("beforeunload", event => {
    if (workspaceSaver.dirty) { workspaceSaver.flush().catch(() => {}); event.preventDefault(); event.returnValue = ""; }
  });
}
async function startCampaignEngine() {
  document.querySelector(".app-shell").inert = true;
  root.innerHTML = `<p role="status">Opening your workspace…</p>`;
  if (DESKTOP_API) await initializeDesktopWorkspace();
  else await initializeBrowserWorkspace();
  document.querySelector(".app-shell").inert = false;
  initializeDesktopApiKey();
  initializeDesktopFoundryApiKey();
  initializeDesktopUpdates();
  initializeArchivistBridge();
}
startCampaignEngine();
