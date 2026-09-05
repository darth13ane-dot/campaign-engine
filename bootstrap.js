/* Start after all feature views and handlers are registered. */
DESKTOP_API?.onPrepareToClose?.(async () => {
  document.querySelector(".app-shell").inert = true;
  try { await workspaceSaver.flush(); DESKTOP_API.finishClose({ ok: true }); }
  catch (error) { document.querySelector(".app-shell").inert = false; DESKTOP_API.finishClose({ ok: false, error: error.message }); }
});
if (!DESKTOP_API) {
  window.addEventListener("pagehide", () => { workspaceSaver.flush().catch(() => {}); });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") workspaceSaver.flush().catch(() => {}); });
  window.addEventListener("beforeunload", event => {
    if (workspaceSaveStatus === "error" && workspaceSaver.dirty) { event.preventDefault(); event.returnValue = ""; }
  });
}
async function startCampaignEngine() {
  if (DESKTOP_API) document.querySelector(".app-shell").inert = true;
  render();
  await initializeDesktopWorkspace();
  document.querySelector(".app-shell").inert = false;
  initializeDesktopApiKey();
  initializeDesktopFoundryApiKey();
  initializeDesktopUpdates();
  initializeArchivistBridge();
}
startCampaignEngine();
