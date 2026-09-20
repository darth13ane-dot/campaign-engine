/* Keep the prepared situation and its records beside live notes. */
let tableReferenceTarget = null;
let tableReviewScene = null;
let tablePinSearch = null;
const TABLE_MUTATIONS = '[data-desk-beat-toggle], [data-desk-beat-move], [data-desk-beat-remove], [data-desk-unpin-ref], [data-desk-capture], [data-desk-clock], [data-desk-revelation], [data-desk-scratch], [data-table-draft], [data-end-session], [data-confirm-end-session]';
const TABLE_FORMS = '[data-desk-beat-form], [data-desk-log-form], [data-desk-pin-form], [data-desk-clock-form], [data-desk-revelation-form]';
function tableCore() { return window.CampaignSessionTable; }
function tableBlocked() { return playerPreviewActive() || workspaceReplacementPending(); }
function tablePinQuery(campaign, desk) { return tablePinSearch?.campaignId === campaign.id && tablePinSearch?.deskId === desk.id ? tablePinSearch.query : ""; }
function tablePinOptions(campaign, desk, query = tablePinQuery(campaign, desk)) {
  const pinned = new Set(desk.pinned.map(prepRecordKey)), session = sessionForDesk(campaign, desk);
  const entries = prepReferenceChoices(campaign, query, { sessions: true }).filter(ref => !pinned.has(prepRecordKey(ref)) && !(ref.type === "session" && sessionPrepCore().referencesMatch(ref, session)));
  return `<option value="">Choose a record or page${entries.length > 100 ? " · refine search for more" : ""}…</option>${entries.slice(0, 100).map(ref => `<option value="${esc(encodeURIComponent(JSON.stringify(ref)))}">${esc(ENTRY_TYPES[ref.type] || ref.type)} · ${esc(ref.name)} · ${esc(String(ref.archivistId || ref.localId || ref.id || "").slice(-8))}</option>`).join("")}`;
}
function tableFocusedScene(desk) {
  const reviewId = desk.status === "ended" && tableReviewScene?.deskId === desk.id && tableReviewScene.campaignId === activeCampaign()?.id ? tableReviewScene.sceneId : desk.focusedBeatId;
  return tableCore().focusedScene(desk, reviewId);
}
function tableReferenceButton(campaign, ref, label = "") {
  const record = prepResolveRecord(campaign, ref);
  return `<button class="table-reference-button" type="button" data-table-reference="${esc(encodeURIComponent(JSON.stringify(ref)))}"><small>${esc(ENTRY_TYPES[ref.type] || ref.type)}${label ? ` · ${esc(label)}` : ""}</small><strong>${esc(record?.name || record?.title || ref.name)}</strong>${record ? "" : `<span>Source unavailable</span>`}</button>`;
}
function tableRecordReader(campaign, desk) {
  if (tableReferenceTarget?.campaignId !== campaign.id || tableReferenceTarget?.deskId !== desk.id) return `<aside class="table-reader table-reader-empty"><p class="eyebrow">QUICK REFERENCE</p><h3>Keep a record beside the scene</h3><p>Open a scene reference or pinned record to read its details here while your notes remain at hand.</p></aside>`;
  const ref = tableReferenceTarget.ref, record = prepResolveRecord(campaign, ref);
  const fields = record ? [["Role", record.role], ["Status", record.status], ["Overview", record.description], ["Details", record.detail], ["Journal", record.body], ["Session notes", record.recap], ["Pressure", record.tension], ["Next step", record.nextStep], ["Voice", record.voice], ["Quirks", record.quirks], ["Relationships", record.relationships], ["Stats / rules", record.statBlock], ["Possible directions", record.directions], ["Tags", record.tags], ["Factions", record.factions]].filter(([, value]) => value != null && String(value).trim()) : [];
  if (record?.referenceType === "pdf") fields.splice(0, fields.length, ["Extracted PDF text", record.body || "No selectable text on this page. Import a text-based or OCR-processed PDF to use it as source notes."]);
  return `<aside class="table-reader" aria-label="Reference reader"><div class="table-reader-heading"><div><p class="eyebrow">${esc(ENTRY_TYPES[ref.type] || ref.type)}</p><h3 tabindex="-1" data-table-reader-heading>${esc(record?.name || record?.title || ref.name)}</h3></div><button type="button" class="prep-icon-button" data-table-close-reference aria-label="Close reference">×</button></div>${record ? `<div class="table-reader-body">${fields.map(([label, value]) => `<section><h4>${esc(label)}</h4><p>${esc(Array.isArray(value) ? value.join("\n") : typeof value === "object" ? JSON.stringify(value, null, 2) : value)}</p></section>`).join("") || `<p>This record has no further saved details.</p>`}</div>` : `<p>This original record is unavailable or its identity is ambiguous. Its link remains saved; a different record with the same name will keep its own identity.</p>`}</aside>`;
}
function tableFocusMarkup(campaign, desk) {
  const scene = tableFocusedScene(desk);
  return `<div class="table-focus-layout"><section class="table-current-scene"><p class="eyebrow">${desk.status === "ended" ? "SCENE REVIEW" : "AT THE TABLE"}</p>${scene ? `<div class="table-scene-heading"><h2>${esc(scene.title)}</h2><span class="tag">${esc(scene.kind || "scene")} · ${Number(scene.minutes) || 0} min${scene.done ? " · complete" : ""}</span></div>${scene.detail ? `<p class="table-scene-detail">${esc(scene.detail)}</p>` : `<p class="prep-help">Use the outline below to choose a scene. Add detail to your preparation before starting its first live desk.</p>`}${scene.question ? `<div class="table-decision"><strong>Meaningful choice</strong><p>${esc(scene.question)}</p></div>` : ""}${prepProvenanceMarkup(campaign, scene)}<div class="table-scene-refs"><h3>At hand for this scene</h3><div class="table-reference-chips">${(scene.references || []).map(ref => tableReferenceButton(campaign, ref)).join("") || `<p class="prep-help">Link records while preparing a scene, or use this desk’s pinned records.</p>`}</div></div>` : `<h2>Choose the next situation</h2><p class="prep-help">Add a scene to the outline, or start from a prepared session. Your table notes remain available below.</p>`}</section>${tableRecordReader(campaign, desk)}</div>`;
}
function tableOutlineMarkup(campaign, desk) {
  const focused = tableFocusedScene(desk);
  return desk.beats.length ? desk.beats.map((beat, index) => `<div class="desk-beat ${beat.done ? "done" : ""} ${focused?.id === beat.id ? "table-beat-focused" : ""}"><button class="check-dot" type="button" data-desk-beat-toggle="${esc(beat.id)}" aria-label="Mark ${esc(beat.title)} ${beat.done ? "not done" : "done"}">${beat.done ? "✓" : ""}</button><button class="table-scene-select" type="button" data-table-focus="${esc(beat.id)}" aria-pressed="${focused?.id === beat.id}"><small>${esc(beat.kind)}${beat.minutes ? ` · ${beat.minutes} min` : ""}</small><strong>${esc(beat.title)}</strong><span>${focused?.id === beat.id ? "In focus" : "Focus scene"}</span></button><div class="desk-order"><button type="button" data-desk-beat-move="${esc(beat.id)}" data-direction="up" aria-label="Move ${esc(beat.title)} up" ${index === 0 ? "disabled" : ""}>↑</button><button type="button" data-desk-beat-move="${esc(beat.id)}" data-direction="down" aria-label="Move ${esc(beat.title)} down" ${index === desk.beats.length - 1 ? "disabled" : ""}>↓</button><button type="button" data-desk-beat-remove="${esc(beat.id)}" aria-label="Remove ${esc(beat.title)}">×</button></div></div>`).join("") : `<p class="empty-copy">Add the first scene, beat, or pressure. The order stays flexible.</p>`;
}
function tableAfterRender() {
  const page = document.querySelector(".session-desk-page");
  if (!page || tableBlocked()) return;
  const desk = activeDesk();
  if (!desk || page.dataset.deskId !== desk.id) return;
  if (desk.status !== "active") {
    page.querySelectorAll(TABLE_MUTATIONS).forEach(control => { if ("disabled" in control) control.disabled = true; });
    page.querySelectorAll(TABLE_FORMS).forEach(form => form.querySelectorAll("input, select, textarea, button").forEach(control => { control.disabled = true; }));
  }
}
function tableRefreshFocus(focusHeading = false) {
  const campaign = activeCampaign(), desk = activeDesk(campaign), area = document.querySelector("[data-table-focus-area]");
  if (!area || !desk || tableBlocked()) return;
  area.innerHTML = tableFocusMarkup(campaign, desk);
  if (focusHeading) area.querySelector("[data-table-reader-heading]")?.focus({ preventScroll: true });
}
const tableRoot = document.querySelector("#viewRoot");
for (const eventType of ["click", "submit", "input", "change"]) tableRoot.addEventListener(eventType, event => {
  const page = event.target.closest(".session-desk-page");
  if (!page) return;
  const mutation = event.target.closest(TABLE_MUTATIONS) || event.type === "submit" && event.target.matches(TABLE_FORMS);
  const desk = activeDesk();
  if (mutation && (tableBlocked() || !desk || page.dataset.deskId !== desk.id || desk.status !== "active")) { event.preventDefault(); event.stopImmediatePropagation(); }
}, true);
tableRoot.addEventListener("input", event => {
  if (tableBlocked()) return;
  if (event.target.matches("[data-table-pin-search]")) {
    const campaign = activeCampaign(), desk = activeDesk(campaign);
    if (desk?.status !== "active") return;
    tablePinSearch = { campaignId: campaign.id, deskId: desk.id, query: event.target.value };
    event.target.form.elements.entry.innerHTML = tablePinOptions(campaign, desk);
  }
  if (event.target.matches("[data-table-draft]")) {
    const desk = activeDesk();
    if (!desk || desk.status !== "active") return;
    try {
      if (tableCore().setDraft(desk, event.target.dataset.tableDraft, event.target.value)) saveState();
      const context = document.querySelector("[data-table-log-context]");
      if (context) context.textContent = desk.tableDrafts?.logSceneRef?.title ? `Note for: ${desk.tableDrafts.logSceneRef.title}` : "";
    } catch (error) { showToast(error.message); }
  }
  if (event.target.matches("[data-scene-reference-search]")) {
    const prep = activeSessionPrep(), scene = prep?.scenes.find(row => row.id === event.target.dataset.sceneReferenceSearch);
    if (!scene) return;
    prepSceneReferenceQuery = event.target.value;
    event.target.form.elements.reference.innerHTML = prepSceneReferenceOptions(activeCampaign(), scene, prepSceneReferenceQuery);
  }
});
tableRoot.addEventListener("change", event => {
  if (!event.target.matches("[data-table-draft]") || tableBlocked()) return;
  const desk = activeDesk();
  if (desk?.status === "active" && tableCore().setDraft(desk, event.target.dataset.tableDraft, event.target.value)) saveState();
});
tableRoot.addEventListener("click", event => {
  const button = event.target.closest("button");
  if (!button || tableBlocked()) return;
  if (button.matches("[data-scene-link], [data-scene-unlink], [data-scene-close-picker]")) {
    event.preventDefault(); event.stopImmediatePropagation();
    const campaign = activeCampaign(), prep = activeSessionPrep(campaign);
    if (!prep || !button.closest(".session-prep-page")) return;
    prepFlushFields(prep);
    if (button.matches("[data-scene-link]")) { window.CampaignHistory.ensureIds(campaign); prepSceneReferencePickerId = button.dataset.sceneLink; prepSceneReferenceQuery = ""; }
    else if (button.matches("[data-scene-unlink]")) tableCore().removeSceneReference(prep.scenes.find(scene => scene.id === button.dataset.sceneId), button.dataset.sceneUnlink);
    else prepSceneReferencePickerId = null;
    saveState(); render(); return;
  }
  const page = button.closest(".session-desk-page"), desk = activeDesk(), campaign = activeCampaign();
  if (!page || !desk || page.dataset.deskId !== desk.id) return;
  if (button.matches("[data-table-reference]")) {
    event.preventDefault(); event.stopImmediatePropagation();
    let ref; try { ref = JSON.parse(decodeURIComponent(button.dataset.tableReference)); } catch { return; }
    const available = tableCore().references(campaign, desk, tableFocusedScene(desk)).find(item => sessionPrepCore().referenceKey(item.ref) === sessionPrepCore().referenceKey(ref));
    if (!available) return;
    tableReferenceTarget = { campaignId: campaign.id, deskId: desk.id, ref: available.ref, origin: button.closest(".table-scene-refs") ? ".table-scene-refs" : ".desk-pins" };
    tableRefreshFocus(true); document.querySelector("[data-table-focus-area]")?.scrollIntoView({ block: "nearest" });
  } else if (button.matches("[data-table-close-reference]")) {
    event.preventDefault(); event.stopImmediatePropagation();
    const previous = tableReferenceTarget;
    tableReferenceTarget = null; tableRefreshFocus();
    if (previous) Array.from(page.querySelectorAll(`${previous.origin} [data-table-reference]`)).find(control => {
      try { return sessionPrepCore().referenceKey(JSON.parse(decodeURIComponent(control.dataset.tableReference))) === sessionPrepCore().referenceKey(previous.ref); } catch { return false; }
    })?.focus({ preventScroll: true });
  } else if (button.matches("[data-table-focus]")) {
    event.preventDefault(); event.stopImmediatePropagation();
    try {
      if (desk.status === "active") { tableCore().focusScene(desk, button.dataset.tableFocus); saveState(); }
      else tableReviewScene = { campaignId: campaign.id, deskId: desk.id, sceneId: button.dataset.tableFocus };
      tableReferenceTarget = null;
      tableRefreshFocus();
      page.querySelector(".desk-beats").innerHTML = tableOutlineMarkup(campaign, desk);
      tableAfterRender();
      const selection = Array.from(page.querySelectorAll("[data-table-focus]")).find(item => item.dataset.tableFocus === button.dataset.tableFocus);
      selection?.focus({ preventScroll: true });
    } catch (error) { showToast(error.message); }
  }
}, true);
tableRoot.addEventListener("submit", event => {
  if (!event.target.matches("[data-scene-reference-form]")) return;
  event.preventDefault(); event.stopImmediatePropagation();
  if (tableBlocked()) return;
  const campaign = activeCampaign(), prep = activeSessionPrep(campaign), scene = prep?.scenes.find(row => row.id === event.target.dataset.sceneReferenceForm);
  if (!scene) return;
  prepFlushFields(prep);
  try { tableCore().addSceneReference(campaign, scene, JSON.parse(decodeURIComponent(event.target.elements.reference.value))); prepSceneReferencePickerId = null; saveState(); render(); } catch (error) { showToast(error.message); }
}, true);
