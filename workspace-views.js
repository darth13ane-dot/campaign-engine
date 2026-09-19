/* Search, sync review, and history share the campaign data modules. */
let searchIndex = null, searchIndexCampaign = null, searchIndexPreview = null, searchLimit = 30, searchMatches = [];
let pendingArchivistReview = null;
let syncReviewApplying = false;
function invalidateCampaignSearch() { searchIndex = null; }
function updateCampaignSearch() {
  const campaign = activeCampaign();
  if (!campaign || workspaceLoadError) return;
  const playerPreview = playerPreviewActive();
  if (!searchIndex || searchIndexCampaign !== campaign.id || searchIndexPreview !== playerPreview) {
    searchIndex = window.CampaignSearch.buildIndex(campaign, { playerPreview, visible: (record, collection) => playerCanSee(record, collection), projectRecord: (record, collection) => window.CampaignPlayerPacket.projectRecord(campaign, prepRecordRef(({ characters: "character", quests: "quest", locations: "location", sessions: "session", journal: "journal" })[collection], record)) });
    searchIndexCampaign = campaign.id;
    searchIndexPreview = playerPreview;
  }
  const query = document.querySelector("#searchInput").value;
  const found = window.CampaignSearch.search(searchIndex, query, { type: document.querySelector("#searchFilter").value, limit: searchLimit });
  searchMatches = found.results;
  const results = document.querySelector("#searchResults");
  results.innerHTML = !query.trim() ? `<p class="empty-copy">Search names, tags, scenes, notes, or rulebook text.</p>` : `<p class="search-count">${found.total} results · showing ${found.results.length}</p>${found.results.map((entry, index) => `<button class="search-result" type="button" data-search-hit="${index}"><span>${esc(window.CampaignSearch.labels[entry.type])}${entry.page ? ` · page ${entry.page}` : ""}</span><strong>${esc(entry.title)}</strong><p>${esc(entry.excerpt)}</p></button>`).join("")}${found.total > found.results.length ? `<button class="secondary-button" type="button" data-more-search>Show more</button>` : ""}`;
}
document.querySelector("#searchButton").addEventListener("click", () => {
  if (!activeCampaign() || workspaceLoadError) return;
  searchIndex = null; searchLimit = 30;
  const filter = document.querySelector("#searchFilter");
  filter.innerHTML = `<option value="all">All records</option>` + Object.entries(window.CampaignSearch.labels).filter(([type]) => !playerPreviewActive() || !["arc", "note", "reference", "prep", "packet"].includes(type)).map(([type, label]) => `<option value="${type}">${esc(label)}</option>`).join("");
  updateCampaignSearch(); searchModal.showModal(); document.querySelector("#searchInput").focus();
});
document.querySelector("#searchInput").addEventListener("input", () => { searchLimit = 30; updateCampaignSearch(); });
document.querySelector("#searchFilter").addEventListener("change", () => { searchLimit = 30; updateCampaignSearch(); });
document.querySelector("#searchResults").addEventListener("click", event => {
  if (event.target.closest("[data-more-search]")) { searchLimit += 30; updateCampaignSearch(); return; }
  const button = event.target.closest("[data-search-hit]");
  const hit = button && searchMatches[Number(button.dataset.searchHit)];
  if (!hit) return;
  searchModal.close();
  if (hit.type === "packet") {
    if (playerPreviewActive()) { showToast("Player packet drafts are available in GM view."); return; }
    const campaign = activeCampaign();
    const packet = campaign.sessionWorkflow?.playerPackets?.[hit.packetId];
    const session = packet && window.CampaignSessionPrep.findSession(campaign, packet.sessionRef);
    if (!session) { showToast("This packet or its session is no longer available in the campaign."); return; }
    openPlayerPacket(campaign, session, packet.id);
    return;
  }
  if (hit.type === "prep") {
    if (playerPreviewActive()) { showToast("Session prep is available in GM view."); return; }
    const campaign = activeCampaign();
    const preps = campaign.sessionWorkflow?.preps || {};
    const prep = preps[hit.prepId] || Object.values(preps).find(value => value?.id === hit.prepId);
    const session = prep && window.CampaignSessionPrep.findSession(campaign, prep.sessionRef);
    if (!session) { showToast("This prepared session is no longer available in the campaign."); return; }
    openSessionPrep(campaign, session);
    return;
  }
  if (hit.type === "reference") { referenceTarget = { id: hit.documentId, page: hit.page }; referenceQuery = document.querySelector("#searchInput").value; currentView = "source-detail"; }
  else if (hit.type === "note") { activeSessionDeskId = hit.deskId; currentView = "session-desk"; }
  else if (hit.type === "arc") { currentView = "arcs"; }
  else { detailTarget = { type: hit.type, name: hit.title, id: hit.id || "" }; currentView = "detail"; }
  render();
  if (hit.type === "arc") {
    const arc = activeCampaign().arcs.find(item => item.title === hit.title);
    if (arc) openArcModal(arc);
  }
});

function historyView(campaign) {
  historyTracker.capture(state.campaigns, nextHistoryLabel);
  const rows = campaign.history || [];
  return `${header("Record history", "CAMPAIGN CHANGES", "Inspect edits and undo an individual operation or a whole consequence batch. Up to 100 recent operations are retained, within a 2 MB history budget.")}
    <div class="history-list">${rows.length ? rows.map(entry => `<section class="card history-entry"><div class="section-title"><div><p class="eyebrow">${esc(new Date(entry.at).toLocaleString())}</p><h2>${esc(entry.label)}</h2></div><span class="tag">${entry.changes.length} record${entry.changes.length === 1 ? "" : "s"}</span></div>${entry.changes.map(change => `<details><summary>${esc(change.title)} · ${esc(change.collection)}</summary>${historyComparison(change)}</details>`).join("")}<button class="secondary-button" type="button" data-undo-history="${esc(entry.id)}" ${entry.undoneAt ? "disabled" : ""}>${entry.undoneAt ? "Undone" : entry.changes.length > 1 ? "Undo this batch" : "Undo this edit"}</button></section>`).join("") : `<section class="empty-state"><h2>No recorded changes yet</h2><p>New record edits and approved consequences will appear here.</p></section>`}</div>`;
}

function prepareArchivistReview(payload) {
  while (payload?.workspace) payload = payload.workspace;
  const incoming = payload?.state?.campaigns ? payload.state : payload;
  if (!Array.isArray(incoming?.campaigns) || !incoming.campaigns.length) throw new Error("Archivist returned no campaigns to review.");
  const details = ARCHIVIST_MERGE.asDetailsRoot(payload.archivist || payload.details || payload.archivistDetails || incoming.archivist || {}, payload.importedAt);
  pendingArchivistReview = { payload, plan: ARCHIVIST_MERGE.createReview(state.campaigns, incoming.campaigns, ARCHIVIST_DETAILS_ROOT, details), choices: {}, warnings: payload.warnings || [] };
}
const historyHiddenFields = new Set(["id", "localId", "archivistId", "sourceId", "source", "updatedAt", "lastEditedBy", "localOverrides", "systemData", "history"]);
function fieldLabel(field) { return field.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, letter => letter.toUpperCase()); }
function syncValue(value) {
  if (value == null) return "Not present";
  if (typeof value !== "object") return String(value);
  if (Array.isArray(value)) return value.map(syncValue).join("\n") || "None";
  return Object.entries(value).filter(([key, val]) => !historyHiddenFields.has(key) && val != null && val !== "").map(([key, val]) => `${fieldLabel(key)}: ${syncValue(val)}`).join("\n") || "No fields recorded";
}
function historyComparison(change) {
  const fields = [...new Set([...Object.keys(change.before || {}), ...Object.keys(change.after || {})])].filter(key => !historyHiddenFields.has(key) && JSON.stringify(change.before?.[key]) !== JSON.stringify(change.after?.[key]));
  if (!fields.length) return `<p class="field-help">The linked source or record tracking information changed.</p>`;
  return fields.map(field => `<section class="history-field"><h3>${esc(fieldLabel(field))}</h3><div class="change-comparison"><section><small>Before</small><pre>${esc(syncValue(change.before?.[field]))}</pre></section><section><small>After</small><pre>${esc(syncValue(change.after?.[field]))}</pre></section></div></section>`).join("");
}
function archivistReviewView() {
  const review = pendingArchivistReview;
  if (!review) return header("No sync preview", "ARCHIVIST", "Open Archivist sync to fetch a preview.", `<button class="secondary-button" type="button" data-view-jump="archivist">Archivist sync</button>`);
  return `${header("Review Archivist changes", "SYNC PREVIEW", "Choose which fields to refresh. Existing local overrides default to Keep local. Source detail records refresh with the import; your current workspace is backed up first.")}
    <section class="card sync-review-summary"><p>${review.plan.rows.length} proposed changes · ${review.plan.rows.filter(row => row.conflict).length} local overrides</p>${review.warnings.length ? `<div role="alert"><h2>Incomplete source data</h2><ul>${review.warnings.map(warning => `<li>${esc(typeof warning === "string" ? warning : warning.message)}</li>`).join("")}</ul></div>` : ""}<button class="primary-button" type="button" data-apply-sync-review ${syncReviewApplying ? "disabled" : ""}>${syncReviewApplying ? "Applying…" : "Apply reviewed sync"}</button><button class="secondary-button" type="button" data-refresh-sync-review ${syncReviewApplying ? "disabled" : ""}>Recheck local changes</button><button class="quiet-button" type="button" data-discard-sync-review ${syncReviewApplying ? "disabled" : ""}>Discard preview</button></section>
    <div class="sync-review-list">${review.plan.rows.map(row => `<section class="card sync-review-row"><div class="section-title"><div><p class="eyebrow">${esc(row.kind === "record" || row.kind === "campaign" ? "New " + row.kind : row.field)}</p><h2>${esc(row.title)}</h2>${row.conflict ? `<span class="tag">Local edit differs</span>` : ""}</div><label>Use<select data-sync-choice="${esc(row.id)}" ${syncReviewApplying ? "disabled" : ""}><option value="local" ${(review.choices[row.id] || row.choice) === "local" ? "selected" : ""}>${row.before == null && ["record", "campaign"].includes(row.kind) ? "Skip addition" : "Keep local"}</option><option value="incoming" ${(review.choices[row.id] || row.choice) === "incoming" ? "selected" : ""}>Archivist</option></select></label></div><details><summary>Compare values</summary><div class="change-comparison"><section><h3>Local</h3><pre>${esc(syncValue(row.before))}</pre></section><section><h3>Archivist</h3><pre>${esc(syncValue(row.incoming))}</pre></section></div></details></section>`).join("")}</div>`;
}
async function applyArchivistReview() {
  if (!pendingArchivistReview || syncReviewApplying || workspaceReplacementPending() || workspaceLoadError) return;
  syncReviewApplying = true; render();
  try {
    await flushDesktopSaves();
    const result = ARCHIVIST_MERGE.applyReview(pendingArchivistReview.plan, state.campaigns, pendingArchivistReview.choices);
    const next = { ...state, source: "archivist", campaigns: result.campaigns };
    next.campaigns.forEach(ensureCampaignPlanning);
    for (const campaign of next.campaigns) {
      const previous = state.campaigns.find(item => item.id === campaign.id);
      if (!previous) continue;
      for (const [type, collection] of Object.entries({ session: "sessions", character: "characters", quest: "quests", location: "locations", journal: "journal" })) {
        for (const old of previous[collection] || []) {
          const updated = campaign[collection].find(item => (old.archivistId && item.archivistId === old.archivistId) || (old.localId && item.localId === old.localId));
          const oldName = old.name || old.title, newName = updated?.name || updated?.title;
          if (newName && oldName !== newName) updateTextReferences(campaign, { type, name: oldName }, { type, name: newName });
        }
      }
    }
    historyTracker.capture(next.campaigns, "Archivist sync");
    const workspace = { schemaVersion: 1, state: next, archivist: result.details };
    if (DESKTOP_API?.replaceWorkspace) {
      const saved = await DESKTOP_API.replaceWorkspace(workspace, "before-archivist-bridge");
      desktopWorkspaceInfo = saved.info || desktopWorkspaceInfo;
    } else localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));
    applyWorkspace(workspace);
    pendingArchivistReview = null; invalidateCampaignSearch();
    archivistBridgeState.mergeStats = result.stats;
    currentView = "archivist"; showToast("Reviewed Archivist changes saved.");
  } catch (error) { historyTracker.reset(state.campaigns); showToast(error.message); }
  finally { syncReviewApplying = false; render(); }
}
root.addEventListener("change", event => {
  if (event.target.matches("[data-sync-choice]") && pendingArchivistReview && !syncReviewApplying) pendingArchivistReview.choices[event.target.dataset.syncChoice] = event.target.value;
});
root.addEventListener("click", async event => {
  const undo = event.target.closest("[data-undo-history]");
  if (undo && !playerPreviewActive()) {
    try { await flushDesktopSaves(); window.CampaignHistory.undo(activeCampaign(), undo.dataset.undoHistory); saveState("Undo record changes"); await flushDesktopSaves(); render(); showToast("Record changes undone."); }
    catch (error) { showToast(error.message); }
  }
  if (event.target.closest("[data-apply-sync-review]")) await applyArchivistReview();
  if (event.target.closest("[data-refresh-sync-review]") && pendingArchivistReview && !syncReviewApplying) {
    try { await flushDesktopSaves(); prepareArchivistReview(pendingArchivistReview.payload); render(); }
    catch (error) { showToast(error.message); }
  }
  if (event.target.closest("[data-discard-sync-review]") && !syncReviewApplying) { pendingArchivistReview = null; currentView = "archivist"; render(); }
});
document.querySelector("#workspaceSaveStatus").addEventListener("click", () => { workspaceSaver.flush().catch(error => showToast(error.message)); });
