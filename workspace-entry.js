/* First use and explicit recovery keep the current workspace intact until a save succeeds. */
let pendingWorkspaceRestore = null;
let workspaceRecoveryCopies = [];
let workspaceRecoveryError = "";
let workspaceRecoveryLoading = false;

function workspaceRestoreControls() {
  return `<button class="secondary-button" type="button" data-workspace-import>Choose backup file</button><button class="quiet-button" type="button" data-workspace-recovery>Browse recovery copies</button>${DESKTOP_API ? "" : `<input class="workspace-file-input" type="file" accept=".json,application/json" data-workspace-file />`}`;
}
function workspaceWelcomeView() {
  if (workspaceLoadError) return `${header("Recover your workspace", "SAVED DATA NEEDS ATTENTION", "Your saved data is preserved. Choose a recovery copy or open a compatible backup to continue.")}
    <section class="card workspace-entry-alert" role="alert"><h2>Workspace could not be opened</h2><p>${esc(workspaceLoadError)}</p><div class="workspace-actions">${workspaceRestoreControls()}<button class="secondary-button" type="button" data-workspace-retry>Retry loading</button>${workspaceLoadErrorCode === "BROWSER_WORKSPACE_CONFLICT" ? `<button class="secondary-button" type="button" data-workspace-resolve-conflict>Open saved workspace</button>` : ""}${DESKTOP_API ? `<button class="quiet-button" data-workspace-open-folder>Open data folder</button>` : `<button class="quiet-button" data-workspace-download-original>Download saved data</button>`}</div></section>`;
  return `<div class="workspace-welcome">${header("Prepare your next session", "WELCOME TO CAMPAIGN ENGINE", "Bring an ongoing campaign or start a new one. Turn your next session into situations, choices, and useful material for the table.")}
    <div class="workspace-start-options">
      <section class="card workspace-start-card"><span class="workspace-step">01 / YOUR CAMPAIGN</span><h2>Start with the next session</h2><p>Choose your game system, name the session, and start preparing. You can add the campaign's people, places, and history as you need them.</p><button class="primary-button" type="button" data-workspace-create>Create a campaign <span>→</span></button></section>
      <section class="card workspace-start-card"><span class="workspace-step">02 / SAVED WORK</span><h2>Continue from a backup</h2><p>Preview the campaigns and template library in a saved workspace, then choose whether to restore it.</p><div class="workspace-actions">${workspaceRestoreControls()}</div></section>
      <section class="card workspace-start-card"><span class="workspace-step">03 / TAKE A LOOK</span><h2>Explore an example</h2><p>Open Ashes of Veyr, a sample fantasy campaign with people, places, and a coming session. You can edit it and keep your changes.</p><button class="secondary-button" type="button" data-workspace-example>Explore example campaign</button></section>
    </div><section class="card workspace-start-footer"><div><h2>Campaign memory, ready for preparation</h2><p>Use Archivist campaign records as context for your plans. You review imported changes before applying them.</p></div><button class="secondary-button" type="button" data-view-jump="archivist">Connect Archivist</button></section><p class="quiet-copy">Preparation works locally across game systems. Your workspace backup includes campaigns, session plans, and custom templates.</p></div>`;
}
function stageWorkspaceRestore(value, label) {
  if (playerPreviewActive()) throw new Error("Workspace recovery is available in GM view.");
  const workspace = prepareWorkspace(value);
  pendingWorkspaceRestore = { workspace, label, baseline: JSON.stringify(workspacePayload()), storage: BROWSER_STORE?.revision };
  currentView = "workspace-restore";
}
function workspaceRestoreView() {
  const pending = pendingWorkspaceRestore;
  if (!pending) return workspaceWelcomeView();
  const summary = window.CampaignWorkspaceSchema.summary(pending.workspace);
  const campaigns = summary.campaigns;
  return `${header("Review this backup", "RESTORE WORKSPACE", "Restoring replaces the current campaigns, plans, settings, and template library. A recovery copy of the current workspace is saved first.")}
    <section class="card workspace-restore-summary"><p class="eyebrow">${esc(pending.label)}</p><h2>${campaigns.length} campaign${campaigns.length === 1 ? "" : "s"} · ${summary.templates} custom template${summary.templates === 1 ? "" : "s"}</h2>
    ${campaigns.length ? `<ul class="workspace-backup-list">${campaigns.map(campaign => `<li><strong>${esc(campaign.title)}</strong><span>${esc(campaign.system)} · ${campaign.sessions} sessions · ${campaign.records} campaign records</span></li>`).join("")}</ul>` : `<p>This backup contains an empty workspace. Its settings and template library will still be restored.</p>`}
    <p class="workspace-replace-notice">Current workspace: ${state.campaigns.length} campaign${state.campaigns.length === 1 ? "" : "s"}. Review this choice before continuing.</p><div class="workspace-actions"><button class="primary-button" type="button" data-workspace-confirm-restore>Restore this workspace</button><button class="secondary-button" type="button" data-workspace-cancel-restore>Keep current workspace</button></div></section>`;
}
async function replaceWorkspaceSafely(value, reason) {
  if (playerPreviewActive()) throw new Error("Workspace recovery is available in GM view.");
  if (workspaceReplacementPending()) throw new Error("Wait for the current workspace update to finish.");
  if (["UNSUPPORTED_WORKSPACE_SCHEMA", "UNSUPPORTED_BROWSER_STORAGE"].includes(workspaceLoadErrorCode)) throw new Error("Open the saved workspace with a compatible Campaign Engine version before replacing it. Its original data remains preserved.");
  const prepared = prepareWorkspace(value);
  workspaceImportInProgress = true;
  document.querySelector(".app-shell").inert = true;
  try {
    await flushDesktopSaves();
    if (DESKTOP_API?.replaceWorkspace) {
      const result = await DESKTOP_API.replaceWorkspace(prepared, reason);
      desktopWorkspaceInfo = result.info || desktopWorkspaceInfo;
      applyWorkspace(result.workspace);
    } else {
      await BROWSER_STORE.replace(prepared, { allowDamaged: reason === "reviewed-restore" });
      applyWorkspace(prepared);
    }
    pendingWorkspaceRestore = null;
    if (typeof pendingArchivistReview !== "undefined") pendingArchivistReview = null;
    currentView = "dashboard"; detailTarget = null; activeFilter = "All";
    invalidateCampaignSearch();
  } catch (error) { noticeBrowserConflict(error); throw error; }
  finally { workspaceImportInProgress = false; document.querySelector(".app-shell").inert = false; render(); }
}
async function confirmWorkspaceRestore() {
  const pending = pendingWorkspaceRestore;
  if (!pending || workspaceReplacementPending()) return;
  try {
    if (pending.baseline !== JSON.stringify(workspacePayload()) || (!DESKTOP_API && pending.storage !== BROWSER_STORE.revision)) throw new Error("The current workspace changed after this preview. Choose the backup again to review it against your latest work.");
    await replaceWorkspaceSafely(pending.workspace, "reviewed-restore");
    showToast("Workspace restored. A recovery copy of the previous workspace is available.");
  } catch (error) { showToast(`Restore failed: ${error.message}`); }
}
async function openWorkspaceRecovery() {
  if (workspaceReplacementPending() || playerPreviewActive()) return;
  currentView = "workspace-recovery"; workspaceRecoveryLoading = true; workspaceRecoveryError = ""; render();
  try {
    if (DESKTOP_API?.listWorkspaceBackups) workspaceRecoveryCopies = await DESKTOP_API.listWorkspaceBackups();
    else workspaceRecoveryCopies = await BROWSER_STORE.listCopies();
  } catch (error) { workspaceRecoveryCopies = []; workspaceRecoveryError = error.message; }
  finally { workspaceRecoveryLoading = false; render(); }
}
function workspaceRecoveryView() {
  return `${header("Recovery copies", "WORKSPACE RECOVERY", DESKTOP_API ? "Preview a local safety copy or the previous automatic save. Your current workspace changes only after you confirm restoration." : "The browser keeps the previous automatic save, original copies from the storage upgrade, and preserved recovery data. Download regular backups to keep additional versions.", `<button class="secondary-button" data-workspace-back>Back to workspace</button>`)}
    <section class="card workspace-restore-summary">${workspaceRecoveryLoading ? `<p role="status">Reading saved copies…</p>` : workspaceRecoveryError ? `<p role="alert">${esc(workspaceRecoveryError)}</p>` : !workspaceRecoveryCopies.length ? `<p>No recovery copies are available yet. Use a downloaded backup, or create a safety copy from Settings.</p>` : `<ul class="workspace-backup-list">${workspaceRecoveryCopies.map(copy => `<li><div><strong>${esc(copy.label || copy.id)}</strong><span>${copy.summary ? `${copy.summary.campaigns.length} campaigns · ${copy.summary.templates} custom templates` : esc(copy.error || "Copy unavailable")}</span>${copy.savedAt ? `<small>${esc(new Date(copy.savedAt).toLocaleString())}</small>` : ""}</div><button class="secondary-button" data-workspace-preview-copy="${esc(copy.id)}" ${copy.summary ? "" : "disabled"}>Preview copy</button>${DESKTOP_API ? "" : `<button class="quiet-button" data-workspace-download-copy="${esc(copy.id)}">Download copy</button>`}</li>`).join("")}</ul>`}<div class="workspace-actions">${workspaceRestoreControls()}${DESKTOP_API ? `<button class="quiet-button" data-workspace-open-folder>Open data folder</button>` : `<button class="quiet-button" data-workspace-download-recovery>Download recovery data</button>`}</div></section>`;
}
async function previewWorkspaceCopy(id) {
  if (workspaceReplacementPending()) return;
  try {
    await flushDesktopSaves();
    const value = DESKTOP_API ? await DESKTOP_API.readWorkspaceBackup(id) : JSON.parse(await BROWSER_STORE.readRaw(id));
    stageWorkspaceRestore(value, workspaceRecoveryCopies.find(copy => copy.id === id)?.label || "Recovery copy"); render();
  } catch (error) { showToast(`Recovery copy could not be opened: ${error.message}`); }
}
async function downloadPreservedWorkspace(recovery = false) {
  try {
    if (DESKTOP_API || playerPreviewActive()) throw new Error("Browser workspace downloads are available in GM view.");
    const raw = await BROWSER_STORE.readRaw(typeof recovery === "string" ? recovery : recovery ? "previous" : "primary");
    if (raw == null) throw new Error("No saved browser data is available to download.");
    const url = URL.createObjectURL(new Blob([raw], { type: "application/json" })), anchor = document.createElement("a");
    anchor.href = url; anchor.download = `campaign-engine-${recovery ? "recovery" : "preserved"}-data.json`; anchor.click(); URL.revokeObjectURL(url);
  } catch (error) { showToast(error.message); }
}
root.addEventListener("click", async event => {
  if (event.target.closest("[data-workspace-resolve-conflict]")) await reloadBrowserWorkspace();
  const downloadCopy = event.target.closest("[data-workspace-download-copy]");
  if (downloadCopy && !playerPreviewActive()) await downloadPreservedWorkspace(downloadCopy.dataset.workspaceDownloadCopy);
  if (event.target.closest("[data-workspace-create]")) campaignModal.showModal();
  if (event.target.closest("[data-workspace-example]") && !workspaceLoadError && !state.campaigns.length) {
    const campaign = structuredClone(seed.campaigns[0]);
    campaign.example = true; ensureCampaignPlanning(campaign); state.campaigns.push(campaign); state.activeCampaignId = campaign.id;
    state.knowledgeMode = "gm"; saveState(); currentView = "dashboard"; render();
  }
  if (event.target.closest("[data-workspace-confirm-restore]")) await confirmWorkspaceRestore();
  if (event.target.closest("[data-workspace-cancel-restore], [data-workspace-back]")) { pendingWorkspaceRestore = null; currentView = "dashboard"; render(); }
  if (event.target.closest("[data-workspace-recovery]")) await openWorkspaceRecovery();
  const copy = event.target.closest("[data-workspace-preview-copy]");
  if (copy) await previewWorkspaceCopy(copy.dataset.workspacePreviewCopy);
  if (event.target.closest("[data-workspace-download-original]")) downloadPreservedWorkspace();
  if (event.target.closest("[data-workspace-download-recovery]")) downloadPreservedWorkspace(true);
  if (event.target.closest("[data-workspace-retry]")) {
    if (DESKTOP_API) await initializeDesktopWorkspace();
    else await initializeBrowserWorkspace();
  }
});
