/* Explicit, recoverable review of material for the next session's preparation. */
let activeContinuityPrepId = null;
let continuityPendingSourceKey = "";
let continuityReviewError = "";

function continuityCore() { return window.CampaignPrepContinuity; }
function activeContinuityPrep(campaign = activeCampaign()) {
  return campaign.sessionWorkflow?.preps?.[activeContinuityPrepId] || null;
}
function continuitySourceKey(source) {
  if (!source) return "current";
  if (source.deskId) return `desk:${source.deskId}`;
  const ref = window.CampaignSessionPrep.sessionReference(source.sessionRef || {});
  const identity = ["archivistId", "localId", "id"].find(key => ref[key]);
  return identity ? `recorded:${identity}:${encodeURIComponent(ref[identity])}` : `recorded:${encodeURIComponent(JSON.stringify(ref))}`;
}
function continuityRememberBaseline(review) {
  (review.candidates || []).forEach(candidate => { candidate.originalAfter = structuredClone(candidate.after); });
  return review;
}
function continuityDraftHasChanges(review) {
  return (review?.candidates || []).some(candidate => candidate.selected || !Object.hasOwn(candidate, "originalAfter") || JSON.stringify(candidate.after) !== JSON.stringify(candidate.originalAfter));
}
function continuitySourceOptions(campaign, session) {
  return continuityCore().sourceSessions(campaign, session).map(source => ({ ...source, value: continuitySourceKey(source) }));
}
function continuityBuildOptions(key, sources) {
  if (key === "current") return { sourceDeskId: null };
  const source = sources.find(item => item.value === key);
  if (!source) throw new Error("The selected source is unavailable. Choose an available source and refresh this review.");
  return source.deskId ? { sourceDeskId: source.deskId } : { sourceSessionRef: source.sessionRef };
}
function openContinuityReview(campaign, targetSession, options = {}) {
  if (playerPreviewActive() || !targetSession || !continuityCore()) return;
  // Establish the same record defaults and identities used by save/reload before taking a snapshot.
  ensureCampaignPlanning(campaign);
  window.CampaignHistory.ensureIds(campaign);
  SESSION_WORKFLOW.ensureWorkflow(campaign);
  const prep = window.CampaignSessionPrep.ensurePrep(campaign, targetSession);
  activeContinuityPrepId = prep.id;
  continuityReviewError = "";
  if (!prep.continuityReview) {
    try { prep.continuityReview = continuityRememberBaseline(continuityCore().buildReview(campaign, targetSession, options)); }
    catch (error) { continuityReviewError = error.message || "This review could not be prepared."; }
  }
  continuityPendingSourceKey = continuitySourceKey(prep.continuityReview?.source);
  if (Object.hasOwn(options, "sourceDeskId")) continuityPendingSourceKey = options.sourceDeskId ? `desk:${options.sourceDeskId}` : "current";
  else if (options.sourceSessionRef) continuityPendingSourceKey = continuitySourceKey({ sessionRef: options.sourceSessionRef });
  currentView = "prep-continuity";
  saveState();
  render();
}
function continuityStatus(campaign, prep, session) {
  if (!prep.continuityReview) return { valid: false, error: continuityReviewError || "Choose a source and refresh to prepare a review." };
  let status;
  try { status = continuityCore().validateReview(campaign, session, prep.continuityReview); }
  catch (error) { status = { valid: false, error: error.message || "The review could not be verified." }; }
  if (continuityPendingSourceKey !== continuitySourceKey(prep.continuityReview.source)) return { valid: false, error: "You selected a different source. Refresh the review to load that source before choosing material to add." };
  return status;
}
function continuitySelected(review) {
  return (review?.candidates || []).filter(candidate => candidate.selected && !candidate.duplicate);
}
function continuityRowTitle(candidate) {
  const after = candidate.after || {};
  return String(after.title || after.character || after.label || after.name || after.text || candidate.label || "Prepared material").slice(0, 240);
}
function continuityRowPreview(candidate) {
  const after = candidate.after || {};
  return String(after.detail || after.opportunity || after.question || after.text || "").slice(0, 260);
}
function continuityValue(value) {
  return value == null ? "" : typeof value === "object" ? JSON.stringify(value, null, 2) : String(value);
}
function continuityField(candidate, key, label, options = {}) {
  const value = candidate.after?.[key] ?? "";
  const attributes = `data-continuity-field="${key}" data-continuity-candidate="${esc(candidate.id)}"`;
  if (options.select) return `<label>${label}<select ${attributes}>${Object.entries(options.select).map(([option, title]) => `<option value="${option}"${option === value ? " selected" : ""}>${title}</option>`).join("")}</select></label>`;
  if (options.number) return `<label>${label}<input ${attributes} type="number" min="${options.min ?? 0}" max="${options.max ?? 1440}" step="1" value="${esc(value)}" /></label>`;
  if (options.short) return `<label>${label}<input ${attributes} maxlength="${options.limit || 240}" value="${esc(value)}" /></label>`;
  return `<label>${label}<textarea ${attributes} rows="${options.rows || 3}" maxlength="${options.limit || 12000}">${esc(value)}</textarea></label>`;
}
function continuityCandidateFields(candidate) {
  const field = (key, label, options) => continuityField(candidate, key, label, options);
  if (candidate.collection === "scenes") return `${field("title", "Scene title", { short: true })}<div class="continuity-field-row">${field("kind", "Scene type", { select: { scene: "Scene", social: "Social", exploration: "Exploration", combat: "Combat", pressure: "Pressure" } })}${field("minutes", "Estimated minutes", { number: true })}</div>${field("detail", "Situation & useful details")}${field("question", "Meaningful question or choice", { rows: 2, limit: 4000 })}`;
  if (candidate.collection === "revelations") return field("text", "Clue or revelation", { limit: 4000 });
  if (candidate.collection === "clocks") return `${field("label", "Clock or counter", { short: true, limit: 160 })}<div class="continuity-field-row">${field("value", "Starting value", { number: true, max: candidate.after?.max || 20 })}${field("max", "Segments / maximum", { number: true, min: 1, max: 20 })}</div>`;
  if (candidate.collection === "tasks") return field("text", "Prep task", { rows: 2, limit: 1000 });
  if (candidate.collection === "spotlights") return `${field("character", "Character", { short: true, limit: 200 })}${field("opportunity", "Spotlight opportunity", { limit: 4000 })}`;
  return `<div class="continuity-preview"><p><strong>${esc(ENTRY_TYPES[candidate.after?.type] || candidate.after?.type || "Campaign reference")}</strong><br />${esc(candidate.after?.name || candidate.label)}</p><p>This pin links to the campaign record through its saved identity.</p></div>`;
}
function continuityCandidateMarkup(candidate, review, valid) {
  const provenance = candidate.provenance || {};
  const sourceLabel = provenance.sourceSessionRef?.name || (["quests", "arcs"].includes(candidate.category) ? "Current campaign" : review.source?.title) || "Current campaign";
  const preview = continuityRowPreview(candidate);
  const editable = candidate.collection !== "pinned";
  return `<article class="card continuity-candidate ${candidate.selected && !candidate.duplicate ? "is-selected" : ""} ${candidate.duplicate ? "is-unavailable" : ""}" data-continuity-card="${esc(candidate.id)}"><div class="continuity-candidate-heading"><div><h3 data-continuity-title>${esc(continuityRowTitle(candidate))}</h3><p class="continuity-reason">${esc(candidate.reason || "Review this material for the next session.")}</p>${preview ? `<p class="continuity-reason" data-continuity-preview>${esc(preview)}</p>` : `<p class="continuity-reason" data-continuity-preview></p>`}</div><label class="continuity-selection"><input type="checkbox" data-continuity-select="${esc(candidate.id)}" ${candidate.selected && !candidate.duplicate ? "checked" : ""} ${candidate.duplicate || !valid ? "disabled" : ""} /><span>${candidate.duplicate ? "Already carried" : "Bring forward"}</span></label></div>
    <p class="continuity-provenance"><span>Source: ${esc(sourceLabel)}</span>${provenance.recordRef?.name ? `<span>Record: ${esc(provenance.recordRef.name)}</span>` : ""}<span>Adds to ${esc({ scenes: "scene outline", revelations: "revelations", clocks: "clocks", tasks: "prep tasks", spotlights: "spotlights", pinned: "pinned references" }[candidate.collection] || "session prep")}</span></p>
    ${candidate.duplicate ? `<p class="continuity-duplicate-note">${esc(candidate.duplicateReason || "This material has already been carried into the target prep. Its existing copy is available there.")}</p>` : ""}
    <details><summary>${editable ? "Review & edit the proposed copy" : "Review this reference"}</summary><fieldset class="continuity-candidate-fields" ${candidate.duplicate || !valid ? "disabled" : ""}>${continuityCandidateFields(candidate)}</fieldset>${candidate.evidence?.length ? `<div class="continuity-preview"><strong>Why this was suggested</strong>${candidate.evidence.map(item => `<p>${esc(item)}</p>`).join("")}</div>` : ""}</details></article>`;
}
function continuityGroupMarkup(review, valid) {
  const recorded = review.source?.kind === "recorded";
  const groups = [
    ["scenes", recorded ? "Previously prepared scenes" : "Unused scenes", recorded ? "Earlier prepared situations to reconsider for this session." : "Situations still available after the recorded play."],
    ["revelations", recorded ? "Previously prepared clues" : "Unrevealed clues", "Discoveries you may still want to put in front of the table."],
    ["clocks", "Clocks & counters", "Carry a pressure forward at its recorded value."],
    ["tasks", "Remaining prep tasks", "Finish practical work that still matters to the next session."],
    ["spotlights", "Spotlight opportunities", "Reconsider character opportunities for the next session."],
    ["pinned", "Pinned campaign references", "Keep useful people, places, and notes close to the new plan."],
    ["quests", "Current quest opportunities", "Turn the campaign's current objectives into scenes you can prepare."],
    ["arcs", "Current story arc opportunities", "Bring an ongoing tension or next step into the session outline."]
  ];
  const categorized = new Map(groups.map(([key]) => [key, []]));
  for (const candidate of review.candidates || []) {
    const category = categorized.has(candidate.category) ? candidate.category : categorized.has(candidate.collection) ? candidate.collection : "pinned";
    categorized.get(category).push(candidate);
  }
  return groups.filter(([key]) => categorized.get(key).length).map(([key, title, help]) => `<section class="continuity-group"><div class="continuity-group-heading"><div><h2>${title}</h2><p>${help}</p></div><span class="tag">${categorized.get(key).length}</span></div><div class="continuity-candidate-list">${categorized.get(key).map(candidate => continuityCandidateMarkup(candidate, review, valid)).join("")}</div></section>`).join("");
}
function continuityEvidenceMarkup(review) {
  const source = review?.source;
  if (!source) return `<section class="card continuity-evidence-card"><p class="eyebrow">CURRENT CAMPAIGN</p><h2>Grounded in your records</h2><p class="continuity-evidence-copy">Current quests and story arcs provide possible next-session situations. Review each suggestion's source and edit its proposed copy before adding it.</p></section>`;
  const log = Array.isArray(source.log) ? source.log : [];
  const consequences = Array.isArray(source.appliedConsequences) ? source.appliedConsequences : [];
  return `<section class="card continuity-evidence-card"><p class="eyebrow">${source.kind === "recorded" ? "RECORDED SESSION NOTES" : "WHAT HAPPENED"}</p><h2>${esc(source.title || source.sessionRef?.name || "Previous session")}</h2><p class="continuity-evidence-meta">${source.kind === "recorded" ? "Stored recap and earlier prepared material." : `Session completed${source.endedAt ? ` · ${esc(new Date(source.endedAt).toLocaleDateString())}` : ""}.`} This is the source snapshot used for this review.</p>
    <details open><summary>${source.kind === "recorded" ? "Stored session notes" : "Recap"}</summary><p class="continuity-evidence-copy">${esc(source.recap || "A recap has yet to be recorded for this session.")}</p></details>
    ${source.scratch ? `<details><summary>Working notes</summary><p class="continuity-evidence-copy">${esc(source.scratch)}</p></details>` : ""}
    ${log.length ? `<details><summary>Session log · ${log.length} entries</summary><div class="continuity-log">${log.map(entry => `<article>${entry.at ? `<time datetime="${esc(entry.at)}">${esc(deskTime(entry.at))}</time>` : ""}<p>${esc(entry.text)}</p></article>`).join("")}</div></details>` : ""}
    <h3>Applied consequences</h3>${source.consequenceNote ? `<p class="continuity-evidence-copy">${esc(source.consequenceNote)}</p>` : ""}${consequences.length ? consequences.map(item => `<article class="continuity-consequence"><strong>${esc(item.summary || item.target?.name || item.record?.title || item.record?.name || "Applied campaign update")}</strong>${item.after != null ? `<p>${esc(continuityValue(item.after))}</p>` : ""}${(item.evidence || []).map(evidence => `<blockquote>${esc(evidence)}</blockquote>`).join("")}</article>`).join("") : `<p class="continuity-evidence-copy">No individually recorded applied consequences are available in this source.</p>`}</section>`;
}
function continuityAlertMarkup(status) {
  const message = continuityReviewError || (!status.valid ? status.error : "");
  return message ? `<div class="continuity-alert" role="alert"><strong>Review needs attention</strong><p>${esc(message)}</p><p>Your saved selections and edits remain available. Refresh review explicitly to rebuild suggestions from the current source and target.</p></div>` : "";
}
function continuityView(campaign) {
  if (playerPreviewActive()) return playerPreviewRestrictedView();
  const prep = activeContinuityPrep(campaign);
  const session = prep && window.CampaignSessionPrep.findSession(campaign, prep.sessionRef);
  if (!prep || !session) return `<div class="empty-state"><h2>This target session is unavailable.</h2><p>Open an available session's preparation to review what to bring forward.</p><button class="primary-button" type="button" data-view-jump="sessions">Back to sessions</button></div>`;
  const review = prep.continuityReview;
  const sources = continuitySourceOptions(campaign, session);
  const status = continuityStatus(campaign, prep, session);
  const selected = continuitySelected(review).length;
  const sourceExists = continuityPendingSourceKey === "current" || sources.some(source => source.value === continuityPendingSourceKey);
  const liveDesk = SESSION_WORKFLOW.findDeskForSession(campaign, session);
  return `<div class="session-prep-page continuity-page" data-continuity-prep-id="${esc(prep.id)}">
    ${header("Bring the story forward", "NEXT SESSION · CONTINUITY REVIEW", "Choose what deserves a place in the next session, then shape the proposed copies for your table.", `<div class="continuity-header-actions"><button class="secondary-button" type="button" data-continuity-back>Back to session prep</button></div>`)}
    <div class="continuity-source-grid"><section class="card continuity-source-panel"><p class="eyebrow">SOURCE MATERIAL</p><div class="continuity-source-controls"><label>Review from<select data-continuity-source><option value="current"${continuityPendingSourceKey === "current" ? " selected" : ""}>Current campaign quests & story arcs</option>${!sourceExists ? `<option value="${esc(continuityPendingSourceKey)}" selected>Previous review source is unavailable</option>` : ""}${sources.map(source => `<option value="${esc(source.value)}"${source.value === continuityPendingSourceKey ? " selected" : ""}>${esc(source.number ? `Session ${source.number} · ` : "")}${esc(source.title)} · ${source.kind === "recorded" ? "recorded notes" : "completed play"}</option>`).join("")}</select></label><button class="secondary-button" type="button" data-continuity-refresh>Refresh review</button></div><p class="prep-help">Refresh rebuilds this review and clears its selections and edits. Saved prep material remains in the target session.</p></section>
    <section class="card continuity-target-panel"><p class="eyebrow">ADD TO SESSION PREP</p><h2>${esc(session.title)}</h2><div class="continuity-target-meta"><span>Session ${esc(session.number || "—")}${session.date ? ` · ${esc(session.date)}` : ""}</span><span>${prep.scenes.length} scenes · ${prep.revelations.length} revelations · ${prep.tasks.filter(task => !task.done).length} open tasks</span></div><p class="continuity-review-note">Selected material is copied into this session's preparation with its source attached.</p>${liveDesk ? `<p class="continuity-review-note">This session already has a live desk. Bring forward updates its preparation; its live notes keep their separate play state.</p>` : ""}</section></div>
    <div class="continuity-apply-error" data-continuity-alert>${continuityAlertMarkup(status)}</div>
    ${review ? `<div class="continuity-toolbar"><div><strong data-continuity-selected-count>${selected} selected to bring forward</strong><p>New suggestions start unselected. Your choices and edits save with this review.</p></div><div class="continuity-toolbar-actions"><button class="secondary-button" type="button" data-continuity-clear ${selected ? "" : "disabled"}>Clear selection</button><button class="primary-button" type="button" data-continuity-apply ${selected && status.valid ? "" : "disabled"}>Add selected to prep <span>→</span></button></div></div>
    <div class="continuity-workspace"><div class="continuity-categories">${review.candidates?.length ? continuityGroupMarkup(review, status.valid) : `<section class="card continuity-empty"><h2>Nothing needs carrying forward yet.</h2><p>This source has no remaining material or current quest and story arc opportunities to suggest. Choose another source or continue preparing the target session.</p><button class="secondary-button" type="button" data-continuity-back>Continue session prep</button></section>`}</div><aside class="continuity-evidence">${continuityEvidenceMarkup(review)}</aside></div>` : `<section class="card continuity-empty"><h2>Prepare a continuity review</h2><p>Choose a completed session, recorded notes, or the current campaign to assemble possible material for this session.</p></section>`}
  </div>`;
}

function continuityEventContext(event) {
  if (playerPreviewActive()) return null;
  const page = event.target.closest("[data-continuity-prep-id]");
  const campaign = activeCampaign();
  const prep = activeContinuityPrep(campaign);
  const session = prep && window.CampaignSessionPrep.findSession(campaign, prep.sessionRef);
  return page && prep && session && page.dataset.continuityPrepId === prep.id ? { page, campaign, prep, session, review: prep.continuityReview } : null;
}
function continuitySave(prep) {
  prep.updatedAt = new Date().toISOString();
  saveState();
}
function continuityUpdateControls(context) {
  const { page, campaign, prep, session, review } = context;
  const status = continuityStatus(campaign, prep, session);
  const selected = continuitySelected(review).length;
  const count = page.querySelector("[data-continuity-selected-count]");
  if (count) count.textContent = `${selected} selected to bring forward`;
  const apply = page.querySelector("[data-continuity-apply]");
  if (apply) apply.disabled = !selected || !status.valid;
  const clear = page.querySelector("[data-continuity-clear]");
  if (clear) clear.disabled = !selected;
  page.querySelector("[data-continuity-alert]").innerHTML = continuityAlertMarkup(status);
}
function continuityApplyField(review, field, commitNumbers = false) {
  const candidate = review?.candidates.find(item => item.id === field.dataset.continuityCandidate);
  const allowed = { scenes: ["title", "kind", "minutes", "detail", "question"], revelations: ["text"], clocks: ["label", "max", "value"], tasks: ["text"], spotlights: ["character", "opportunity"] };
  const key = field.dataset.continuityField;
  if (!candidate || candidate.duplicate || !Object.hasOwn(allowed, candidate.collection) || !allowed[candidate.collection].includes(key)) return false;
  const after = candidate.after;
  let value = field.value;
  if (field.type === "number") {
    if (!commitNumbers && (!String(value).trim() || !Number.isFinite(Number(value)))) return false;
    const fallback = key === "max" ? 4 : key === "minutes" ? 30 : 0;
    const max = key === "max" ? 20 : key === "value" ? after.max : 1440;
    value = Math.max(key === "max" ? 1 : 0, Math.min(max, Math.round(String(value).trim() && Number.isFinite(Number(value)) ? Number(value) : fallback)));
    if (commitNumbers) field.value = String(value);
  }
  if (key === "kind" && !["scene", "social", "exploration", "combat", "pressure"].includes(value)) return false;
  const changed = after[key] !== value;
  after[key] = value;
  const card = field.closest("[data-continuity-card]");
  if (key === "max") {
    after.value = Math.min(after.value, value);
    const valueField = card.querySelector('[data-continuity-field="value"]');
    if (valueField) { valueField.max = String(value); valueField.value = String(after.value); }
  }
  card.querySelector("[data-continuity-title]").textContent = continuityRowTitle(candidate);
  card.querySelector("[data-continuity-preview]").textContent = continuityRowPreview(candidate);
  return changed;
}
function continuityFlushFields(context) {
  let changed = false;
  context.page.querySelectorAll("[data-continuity-field]").forEach(field => { if (continuityApplyField(context.review, field, true)) changed = true; });
  if (changed) continuitySave(context.prep);
}

const continuityRoot = document.querySelector("#viewRoot");
continuityRoot.addEventListener("input", event => {
  const context = continuityEventContext(event);
  const field = event.target.closest("[data-continuity-field]");
  if (!context || !field || !continuityStatus(context.campaign, context.prep, context.session).valid) return;
  if (continuityApplyField(context.review, field)) {
    continuityReviewError = "";
    continuitySave(context.prep);
    continuityUpdateControls(context);
  }
});
continuityRoot.addEventListener("change", event => {
  const context = continuityEventContext(event);
  if (!context) return;
  if (event.target.matches("[data-continuity-source]")) {
    continuityFlushFields(context);
    continuityPendingSourceKey = event.target.value;
    continuityReviewError = "";
    render();
    return;
  }
  if (!continuityStatus(context.campaign, context.prep, context.session).valid) return;
  const checkbox = event.target.closest("[data-continuity-select]");
  if (checkbox) {
    const candidate = context.review?.candidates.find(item => item.id === checkbox.dataset.continuitySelect);
    if (!candidate || candidate.duplicate) return;
    candidate.selected = checkbox.checked;
    checkbox.closest("[data-continuity-card]").classList.toggle("is-selected", candidate.selected);
    continuityReviewError = "";
    continuitySave(context.prep);
    continuityUpdateControls(context);
    return;
  }
  const field = event.target.closest("[data-continuity-field]");
  if (field) {
    if (continuityApplyField(context.review, field, true)) continuitySave(context.prep);
    continuityUpdateControls(context);
  }
});
continuityRoot.addEventListener("click", event => {
  const context = continuityEventContext(event);
  const button = event.target.closest("button");
  if (!context || !button) return;
  const action = ["refresh", "back", "clear", "apply"].find(value => button.hasAttribute(`data-continuity-${value}`));
  if (!action) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  continuityFlushFields(context);
  const { campaign, prep, session, review } = context;
  if (action === "back") { openSessionPrep(campaign, session); return; }
  if (action === "refresh") {
    if (continuityDraftHasChanges(review) && !confirm("Refresh this review and discard its saved selections and candidate edits?")) return;
    try {
      ensureCampaignPlanning(campaign);
      window.CampaignHistory.ensureIds(campaign);
      const options = continuityBuildOptions(continuityPendingSourceKey, continuitySourceOptions(campaign, session));
      prep.continuityReview = continuityRememberBaseline(continuityCore().buildReview(campaign, session, options));
      continuityPendingSourceKey = continuitySourceKey(prep.continuityReview.source);
      continuityReviewError = "";
      continuitySave(prep);
      render();
      showToast("Continuity review refreshed. Choose what to bring forward.");
    } catch (error) { continuityReviewError = error.message || "This review could not be refreshed."; continuityUpdateControls(context); }
    return;
  }
  if (action === "clear") {
    (review?.candidates || []).forEach(candidate => { candidate.selected = false; });
    continuityReviewError = "";
    continuitySave(prep);
    context.page.querySelectorAll("[data-continuity-select]").forEach(field => { field.checked = false; field.closest("[data-continuity-card]").classList.remove("is-selected"); });
    continuityUpdateControls(context);
    return;
  }
  if (!review) return;
  try {
    const status = continuityStatus(campaign, prep, session);
    if (!status.valid) throw new Error(status.error || "Refresh this review before applying its selections.");
    const selections = continuitySelected(review).map(candidate => ({ id: candidate.id, accepted: true, after: structuredClone(candidate.after) }));
    if (!selections.length) return;
    const result = continuityCore().applyReview(campaign, session, review, selections);
    const index = state.campaigns.findIndex(item => item.id === campaign.id);
    if (index < 0) throw new Error("The target campaign is unavailable. Your review remains saved.");
    const nextSession = window.CampaignSessionPrep.findSession(result.campaign, prep.sessionRef);
    if (!nextSession) throw new Error("The target session could not be resolved. Your review remains saved.");
    state.campaigns[index] = result.campaign;
    continuityReviewError = "";
    saveState();
    openSessionPrep(result.campaign, nextSession);
    showToast(`${result.added.length} ${result.added.length === 1 ? "item" : "items"} added to session prep.${result.skipped?.length ? ` ${result.skipped.length} already present.` : ""}`);
  } catch (error) {
    continuityReviewError = error.message || "The selected material could not be added. Your review remains saved.";
    continuityUpdateControls(context);
  }
}, true);
