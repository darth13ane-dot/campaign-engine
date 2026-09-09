/* Reusable GM planning instructions and explicit application to a session. */
let prepTemplateTarget = null;
let prepTemplateEditor = null;
let prepTemplateEditorSaved = false;
let prepTemplateReviewPrepId = null;
let prepTemplateSearch = "";
let prepTemplateError = "";

const TEMPLATE_COLLECTIONS = { scenes: "Scenes", revelations: "Revelations", clocks: "Clocks & counters", spotlights: "Spotlight opportunities", tasks: "Prep tasks" };
const TEMPLATE_PROMPT_FIELDS = { scenes: { title: "Scene title", detail: "Situation & useful details", question: "Meaningful question or choice" }, revelations: { text: "Revelation" }, clocks: { label: "Clock or counter" }, spotlights: { character: "Character", opportunity: "Opportunity" }, tasks: { text: "Prep task" } };
const TEMPLATE_SCENE_KINDS = { scene: "Scene", social: "Social", exploration: "Exploration", combat: "Combat", pressure: "Pressure" };

function prepTemplatesCore() { return window.CampaignPrepTemplates; }
function prepTemplatesBlocked() { return playerPreviewActive() || (typeof workspaceReplacementPending === "function" && workspaceReplacementPending()); }
function prepTemplatePendingView() {
  if (playerPreviewActive()) return playerPreviewRestrictedView();
  return `<section class="empty-state"><h2>Workspace update in progress</h2><p>Your templates will be available when the workspace update finishes.</p></section>`;
}
function prepTemplateUnavailableView(error, campaign) {
  return `<div class="session-prep-page template-page" data-template-page="unavailable"><section class="template-alert" role="alert"><strong>Template library unavailable</strong><p>${esc(error.message || "The saved template library could not be opened. Its data remains preserved.")}</p></section><div class="template-actions">${prepTemplateBackButton(campaign)}</div></div>`;
}
function prepTemplateSafeView(campaign, content) {
  if (prepTemplatesBlocked()) return prepTemplatePendingView();
  try { prepTemplateLibrary(); return content(campaign); }
  catch (error) { return prepTemplateUnavailableView(error, campaign); }
}
function prepTemplateLibrary() { return prepTemplatesCore().ensureLibrary(state); }
function prepTemplateList() { return prepTemplatesCore().listTemplates(prepTemplateLibrary()); }
function prepTemplateFind(id) { return prepTemplateList().find(template => template.id === id) || null; }
function prepTemplateSession(campaign) {
  return prepTemplateTarget?.campaignId === campaign.id ? window.CampaignSessionPrep.findSession(campaign, prepTemplateTarget.sessionRef) : null;
}
function prepTemplateEstablishIds(campaign) {
  ensureCampaignPlanning(campaign);
  window.CampaignHistory.ensureIds(campaign);
  SESSION_WORKFLOW.ensureWorkflow(campaign);
}
function prepTemplateRememberTarget(campaign, session) {
  prepTemplateTarget = session ? { campaignId: campaign.id, sessionRef: window.CampaignSessionPrep.sessionReference(session) } : null;
}
function openPrepTemplates(campaign, session) {
  if (prepTemplatesBlocked() || !prepTemplatesCore()) return;
  prepTemplateRememberTarget(campaign, session);
  prepTemplateSearch = "";
  prepTemplateError = "";
  currentView = "prep-templates";
  try {
    prepTemplateLibrary();
    prepTemplateEstablishIds(campaign);
    const prep = session && window.CampaignSessionPrep.findPrepForSession(campaign, session);
    if (prep?.templateReview) { prepTemplateReviewPrepId = prep.id; currentView = "prep-template-review"; }
    saveState();
  }
  catch (error) { prepTemplateError = error.message; }
  render();
}
function openPrepTemplateCapture(campaign, session) {
  if (prepTemplatesBlocked() || !session || !prepTemplatesCore()) return;
  prepTemplateEstablishIds(campaign);
  const prep = window.CampaignSessionPrep.ensurePrep(campaign, session);
  prepTemplateRememberTarget(campaign, session);
  prepTemplateEditor = prepTemplatesCore().captureStructure(prep, { name: "My session structure", summary: "Reusable planning structure." });
  prepTemplateEditorSaved = false;
  prepTemplateError = "";
  currentView = "prep-template-editor";
  render();
}
function prepTemplateAlertMarkup() {
  return prepTemplateError ? `<div class="template-alert" role="alert"><strong>Review needed</strong><p>${esc(prepTemplateError)}</p></div>` : "";
}
function prepTemplateBackButton(campaign) {
  return `<button class="secondary-button" type="button" data-template-back>${prepTemplateSession(campaign) ? "Back to session prep" : "Back to sessions"}</button>`;
}
function prepTemplateCardMarkup(template, session) {
  const scenes = template.scenes || [];
  const minutes = scenes.reduce((sum, scene) => sum + (Number(scene.minutes) || 0), 0);
  return `<article class="card template-card"><p class="eyebrow">${template.builtin ? "BUILT-IN STRUCTURE" : "YOUR REUSABLE TEMPLATE"}</p><h3>${esc(template.name)}</h3><p class="template-card-summary">${esc(template.summary || "A structure you can adapt for your table.")}</p><div class="template-card-meta"><span>${scenes.length} scene ${scenes.length === 1 ? "prompt" : "prompts"}</span><span>${minutes} suggested scene minutes</span></div>${scenes.length ? `<ol>${scenes.map((scene, index) => `<li>${esc(scene.prompts?.title || `Scene ${index + 1}`)}</li>`).join("")}</ol>` : `<p class="prep-help">Add scenes and supporting prompts in the editor.</p>`}<div class="template-actions"><button class="primary-button" type="button" data-template-review="${esc(template.id)}" ${session ? "" : "disabled"}>Review for this session</button>${template.builtin ? `<button class="secondary-button" type="button" data-template-copy="${esc(template.id)}">Make an editable copy</button>` : `<button class="secondary-button" type="button" data-template-edit="${esc(template.id)}">Edit</button><button class="secondary-button" type="button" data-template-copy="${esc(template.id)}">Duplicate</button><button class="secondary-button" type="button" data-template-delete="${esc(template.id)}">Delete</button>`}</div></article>`;
}
function prepTemplateLibraryCards(campaign) {
  const session = prepTemplateSession(campaign);
  const query = prepTemplateSearch.trim().toLocaleLowerCase();
  const templates = prepTemplateList().filter(template => !query || `${template.name} ${template.summary}`.toLocaleLowerCase().includes(query));
  return [[true, "Ready-made structures"], [false, "Your templates"]].map(([builtin, title]) => {
    const choices = templates.filter(template => Boolean(template.builtin) === builtin);
    return `<section class="template-library-section"><div class="template-library-heading"><h2>${title}</h2><span>${choices.length}</span></div>${choices.length ? `<div class="template-library-grid">${choices.map(template => prepTemplateCardMarkup(template, session)).join("")}</div>` : `<div class="template-empty"><p>${query ? "No templates match this search." : "Create a reusable structure, copy a starter, or capture the shape of a prepared session."}</p></div>`}</section>`;
  }).join("");
}
function prepTemplatesView(campaign) { return prepTemplateSafeView(campaign, prepTemplatesContent); }
function prepTemplatesContent(campaign) {
  if (prepTemplatesBlocked()) return prepTemplatePendingView();
  const session = prepTemplateSession(campaign);
  const sessions = [...(campaign.sessions || [])].sort((a, b) => Number(Boolean(b.upcoming)) - Number(Boolean(a.upcoming)) || Number(b.number || 0) - Number(a.number || 0));
  return `<div class="session-prep-page template-page" data-template-page="library">${header("Prep templates", "STRUCTURE FOR THE NEXT SESSION", "Choose a useful shape for the session, then make it your own. Your saved templates are available across your campaigns.", `<div class="template-header-actions">${prepTemplateBackButton(campaign)}<button class="primary-button" type="button" data-template-new>＋ New template</button></div>`)}
    <section class="card template-target-bar"><div><h2>Prepare for a session</h2><p>Choose the destination before reviewing a template. Its prompts become a starting point for your own session writing.</p></div><label>Session in ${esc(campaign.title || "this campaign")}<select data-template-target><option value="">Choose a session…</option>${sessions.map(item => `<option value="${esc(sessionActionRef(item))}"${session === item ? " selected" : ""}>${esc(item.number ? `Session ${item.number} · ` : "")}${esc(item.title)}${item.upcoming ? " · upcoming" : ""}</option>`).join("")}</select></label></section>
    <div data-template-alert>${prepTemplateAlertMarkup()}</div><div class="template-library-tools"><label>Find a template<input type="search" data-template-search value="${esc(prepTemplateSearch)}" placeholder="Search investigations, journeys, your structures…" /></label>${session ? `<button class="secondary-button" type="button" data-template-capture>Save this session’s structure</button>` : ""}</div><div data-template-library-cards>${prepTemplateLibraryCards(campaign)}</div></div>`;
}
function prepTemplateEditorField(field, label, value, options = {}) {
  const attrs = `data-template-editor-field="${esc(field)}"${options.collection ? ` data-template-collection="${esc(options.collection)}" data-template-index="${options.index}"` : ""}${options.prompt ? ' data-template-prompt="true"' : ""}`;
  if (options.checkbox) return `<label class="template-checkbox"><input type="checkbox" ${attrs} ${value ? "checked" : ""} /><span>${label}</span></label>`;
  if (options.select) return `<label>${label}<select ${attrs}>${Object.entries(options.select).map(([key, text]) => `<option value="${key}"${value === key ? " selected" : ""}>${text}</option>`).join("")}</select></label>`;
  if (options.number) return `<label>${label}<input type="number" min="${options.min ?? 0}" max="${options.max ?? 1440}" step="1" ${attrs} value="${esc(value ?? 0)}" /></label>`;
  if (options.short) return `<label>${label}<input ${attrs} maxlength="${options.limit || 160}" value="${esc(value || "")}" /></label>`;
  return `<label>${label}<textarea ${attrs} rows="${options.rows || 3}" maxlength="${field === "summary" ? 1000 : 4000}">${esc(value || "")}</textarea></label>`;
}
function prepTemplateEditorRow(collection, row, index, total) {
  const field = (key, label, options = {}) => prepTemplateEditorField(key, label, options.prompt ? row.prompts?.[key] : row[key], { collection, index, ...options });
  const title = Object.values(row.prompts || {}).find(value => String(value).trim()) || `${TEMPLATE_COLLECTIONS[collection]} ${index + 1}`;
  return `<article class="template-edit-row" data-template-editor-row="${collection}:${index}"><div class="template-row-heading"><div><p class="eyebrow">${esc(TEMPLATE_COLLECTIONS[collection])} · ${index + 1}</p><h3 data-template-editor-row-title>${esc(title)}</h3></div><div class="template-row-buttons"><button type="button" data-template-row-move="${collection}:${index}" data-template-direction="-1" aria-label="Move ${esc(collection)} prompt ${index + 1} up" ${index ? "" : "disabled"}>↑</button><button type="button" data-template-row-move="${collection}:${index}" data-template-direction="1" aria-label="Move ${esc(collection)} prompt ${index + 1} down" ${index < total - 1 ? "" : "disabled"}>↓</button><button type="button" data-template-row-remove="${collection}:${index}" aria-label="Remove ${esc(collection)} prompt ${index + 1}">×</button></div></div>${collection === "scenes" ? `<div class="template-field-pair">${field("kind", "Scene type", { select: TEMPLATE_SCENE_KINDS })}${field("minutes", "Suggested minutes", { number: true })}</div>` : ""}${collection === "clocks" ? field("max", "Segments / maximum", { number: true, min: 1, max: 20 }) : ""}${Object.entries(TEMPLATE_PROMPT_FIELDS[collection]).map(([key, label]) => field(key, `${label} prompt`, { prompt: true, rows: key === "title" || key === "character" || key === "label" ? 2 : 3 })).join("")}${field("optional", "Optional: leave this prompt unselected in a new review", { checkbox: true })}</article>`;
}
function prepTemplateEditorGroup(collection) {
  const rows = prepTemplateEditor[collection] || [];
  return `<section class="card template-panel"><h2>${TEMPLATE_COLLECTIONS[collection]}</h2><div class="template-row-list">${rows.length ? rows.map((row, index) => prepTemplateEditorRow(collection, row, index, rows.length)).join("") : `<p class="prep-help">Add a reusable prompt when this part belongs in your structure.</p>`}</div><div><button class="secondary-button" type="button" data-template-row-add="${collection}">＋ Add ${collection === "scenes" ? "scene" : collection === "clocks" ? "clock" : collection === "spotlights" ? "spotlight" : collection === "tasks" ? "task" : "revelation"} prompt</button></div></section>`;
}
function prepTemplateEditorView(campaign) { return prepTemplateSafeView(campaign, prepTemplateEditorContent); }
function prepTemplateEditorContent(campaign) {
  if (prepTemplatesBlocked()) return prepTemplatePendingView();
  if (!prepTemplateEditor) return `<div class="template-page" data-template-page="editor"><section class="empty-state"><h2>Choose a template to edit</h2><button class="primary-button" type="button" data-template-library>Open template library</button></section></div>`;
  const template = prepTemplateEditor;
  return `<div class="session-prep-page template-page" data-template-page="editor">${header("Edit reusable structure", "YOUR PREP TEMPLATE", "Write instructions you can use again with another group, game system, or campaign.", `<div class="template-header-actions"><button class="secondary-button" type="button" data-template-library>Template library</button>${prepTemplateEditorSaved ? `<button class="primary-button" type="button" data-template-editor-review ${prepTemplateSession(campaign) ? "" : "disabled"}>Review for this session</button>` : `<button class="primary-button" type="button" data-template-save-capture>Save template</button>`}</div>`)}
    <div class="template-notice"><strong>${prepTemplateEditorSaved ? "Reusable instructions · changes save automatically" : "Captured structure · review before saving"}</strong><p>${prepTemplateEditorSaved ? "These prompts guide future preparation. Write each session’s people, places, and events in its application review or Session Prep." : "Only the arrangement, scene types, suggested timing, and clock sizes were captured. The text below is neutral planning guidance. Review or rewrite it, then save this template to your library."}</p></div><div data-template-alert>${prepTemplateAlertMarkup()}</div>
    <div class="template-edit-grid"><div class="template-edit-main"><section class="card template-panel"><h2>Template details</h2>${prepTemplateEditorField("name", "Template name", template.name, { short: true })}${prepTemplateEditorField("summary", "When this structure is useful", template.summary, { rows: 2 })}${prepTemplateEditorField("durationMinutes", "Suggested session length (minutes)", template.durationMinutes, { number: true, min: 15 })}${prepTemplateEditorField("openingPrompt", "Opening situation prompt", template.openingPrompt)}</section>${prepTemplateEditorGroup("scenes")}</div><aside class="template-edit-support">${["revelations", "clocks", "spotlights", "tasks"].map(prepTemplateEditorGroup).join("")}</aside></div></div>`;
}
function prepTemplateReviewPrep(campaign) { return campaign.sessionWorkflow?.preps?.[prepTemplateReviewPrepId] || null; }
function prepTemplateReviewContext(campaign) {
  const prep = prepTemplateReviewPrep(campaign);
  const review = prep?.templateReview;
  const session = prep && window.CampaignSessionPrep.findSession(campaign, prep.sessionRef);
  const template = review && prepTemplateFind(review.template?.id);
  return { campaign, prep, review, session, template };
}
function prepTemplateReviewStatus(context) {
  if (!context.review || !context.session) return { valid: false, error: "This saved review is unavailable. Choose a session and a template to begin." };
  if (!context.template) return { valid: false, error: "This template is no longer in your library. Your review remains saved; choose an available template to prepare a new review." };
  try { return prepTemplatesCore().validateReview(context.campaign, context.session, context.template, context.review); }
  catch (error) { return { valid: false, error: error.message || "The review could not be checked." }; }
}
function prepTemplateReviewHasEdits(review) {
  return Boolean(review && (review.useDuration || (review.rows || []).some(row => JSON.stringify(row.after) !== JSON.stringify(row.initialAfter) || row.selected !== row.initialSelected)));
}
function prepTemplateReviewBaseline(review) {
  (review.rows || []).forEach(row => { row.initialAfter = structuredClone(row.after); row.initialSelected = row.selected; });
  return review;
}
function openPrepTemplateReview(campaign, session, templateId) {
  if (prepTemplatesBlocked() || !session) return;
  prepTemplateEstablishIds(campaign);
  const template = prepTemplateFind(templateId);
  if (!template) { prepTemplateError = "This template is unavailable."; render(); return; }
  const prep = window.CampaignSessionPrep.ensurePrep(campaign, session);
  if (prep.templateReview && prep.templateReview.template?.id !== templateId && !confirm("Replace the saved template review for this session? This clears its selections and session writing; existing prep stays saved.")) return;
  if (!prep.templateReview || prep.templateReview.template?.id !== templateId) prep.templateReview = prepTemplateReviewBaseline(prepTemplatesCore().buildReview(campaign, session, template));
  prepTemplateReviewPrepId = prep.id;
  prepTemplateRememberTarget(campaign, session);
  prepTemplateError = "";
  currentView = "prep-template-review";
  saveState();
  render();
}
function prepTemplateGuidance(prompts) {
  const values = Object.entries(prompts || {}).filter(([, value]) => String(value || "").trim());
  return values.length ? `<div class="template-guidance"><strong>Planning prompts</strong>${values.map(([, value]) => `<p>${esc(value)}</p>`).join("")}</div>` : "";
}
function prepTemplateReviewField(row, key, label, options = {}) {
  const attrs = `data-template-review-field="${esc(key)}" data-template-review-row="${esc(row.id)}"`;
  const value = row.after?.[key] ?? "";
  if (options.select) return `<label>${label}<select ${attrs}>${Object.entries(options.select).map(([key, text]) => `<option value="${key}"${value === key ? " selected" : ""}>${text}</option>`).join("")}</select></label>`;
  if (options.number) return `<label>${label}<input type="number" min="${options.min ?? 0}" max="${options.max ?? 1440}" step="1" ${attrs} value="${esc(value)}" /></label>`;
  const limit = key === "label" ? 160 : key === "character" ? 200 : key === "title" ? 240 : row.collection === "tasks" ? 1000 : key === "detail" || key === "opening" ? 12000 : 4000;
  if (options.short) return `<label>${label}<input ${attrs} maxlength="${limit}" value="${esc(value)}" placeholder="Write for this session" /></label>`;
  return `<label>${label}<textarea ${attrs} rows="${options.rows || 3}" maxlength="${limit}" placeholder="Write for this session">${esc(value)}</textarea></label>`;
}
function prepTemplateCandidateMarkup(row, valid) {
  const after = row.after || {};
  const label = row.collection === "opening" ? "Opening situation" : after.prompts?.title || after.prompts?.label || after.prompts?.text || after.prompts?.opportunity || TEMPLATE_COLLECTIONS[row.collection] || "Planning prompt";
  const field = (key, title, options) => prepTemplateReviewField(row, key, title, options);
  let fields = "";
  if (row.collection === "opening") fields = `${field("opening", "Opening text to append", { rows: 4 })}<p class="prep-help">Any text you write here is appended to the current opening. The planning prompt is kept separately.</p>`;
  else if (row.collection === "scenes") fields = `${field("title", "Scene title", { short: true })}<div class="template-field-pair">${field("kind", "Scene type", { select: TEMPLATE_SCENE_KINDS })}${field("minutes", "Estimated minutes", { number: true })}</div>${field("detail", "Situation & useful details")}${field("question", "Meaningful question or choice", { rows: 2 })}`;
  else if (row.collection === "clocks") fields = `${field("label", "Clock or counter", { short: true })}${field("max", "Segments / maximum", { number: true, min: 1, max: 20 })}<p class="prep-help">A new clock starts at zero.</p>`;
  else fields = Object.entries(TEMPLATE_PROMPT_FIELDS[row.collection] || {}).map(([key, title]) => field(key, title, { short: key === "character", rows: 2 })).join("");
  return `<article class="card template-candidate ${row.selected ? "is-selected" : ""}" data-template-candidate="${esc(row.id)}"><div class="template-row-heading"><div><p class="eyebrow">${row.collection === "opening" ? "OPENING GUIDANCE" : esc(TEMPLATE_COLLECTIONS[row.collection])}</p><h3>${esc(label)}</h3>${row.collection === "scenes" ? `<p class="prep-help" data-template-candidate-time>${Number(after.minutes) || 0} suggested minutes</p>` : ""}</div><label class="template-checkbox"><input type="checkbox" data-template-include="${esc(row.id)}" ${row.selected ? "checked" : ""} ${valid ? "" : "disabled"} /><span>Include</span></label></div>${prepTemplateGuidance(after.prompts)}<details${row.collection === "opening" ? " open" : ""}><summary>Write this session’s details</summary><fieldset ${valid ? "" : "disabled"}>${fields}</fieldset></details></article>`;
}
function prepTemplateReviewTotals(review) {
  const selected = (review?.rows || []).filter(row => row.selected);
  return { count: selected.length, scenes: selected.filter(row => row.collection === "scenes").length, minutes: selected.filter(row => row.collection === "scenes").reduce((sum, row) => sum + (Number(row.after?.minutes) || 0), 0) };
}
function prepTemplateReviewToolbar(context, status) {
  const totals = prepTemplateReviewTotals(context.review);
  return `<div><strong>${totals.count} ${totals.count === 1 ? "prompt" : "prompts"} selected</strong><p>${totals.scenes} new scenes · ${totals.minutes} suggested minutes. Your selections and session writing save with this review.</p></div><div class="template-actions"><button class="secondary-button" type="button" data-template-clear-review ${status.valid ? "" : "disabled"}>Clear selection</button><button class="primary-button" type="button" data-template-apply ${status.valid && (totals.count || context.review?.useDuration) ? "" : "disabled"}>Add selected to prep <span>→</span></button></div>`;
}
function prepTemplateReviewView(campaign) { return prepTemplateSafeView(campaign, prepTemplateReviewContent); }
function prepTemplateReviewContent(campaign) {
  if (prepTemplatesBlocked()) return prepTemplatePendingView();
  const context = prepTemplateReviewContext(campaign), { prep, review, session, template } = context;
  if (!prep || !review || !session) return `<div class="session-prep-page template-page" data-template-page="review"><section class="empty-state"><h2>This template review is unavailable</h2><button class="primary-button" type="button" data-template-library>Choose a template</button></section></div>`;
  const status = prepTemplateReviewStatus(context);
  const before = review.target?.before || {};
  return `<div class="session-prep-page template-page" data-template-page="review">${header("Shape your session", "TEMPLATE APPLICATION REVIEW", "Review the structure, choose useful prompts, and write any details you already know before adding it to prep.", `<div class="template-header-actions"><button class="secondary-button" type="button" data-template-library>Template library</button><button class="secondary-button" type="button" data-template-back>Session prep</button></div>`)}
    <div class="template-review-context"><section class="card template-panel"><div><p class="eyebrow">ADD TO SESSION PREP</p><h2>${esc(session.title)}</h2><div class="template-counts"><span>Session ${esc(session.number || "—")}</span><span>${prep.scenes.length} existing scenes</span><span>${prep.durationMinutes} minute session</span></div></div><p class="prep-help">${review.target?.hasLiveDesk ? "This session has a live desk. Applying a template adds to its preparation; the live desk keeps its own play state." : "Selected prompts are appended to this preparation. You can fill them in now or continue writing in Session Prep."}</p>${before.opening ? `<details><summary>Current opening</summary><p class="prep-help">${esc(before.opening)}</p></details>` : ""}</section><section class="card template-panel"><div><p class="eyebrow">REUSABLE STRUCTURE</p><h2>${esc(template?.name || review.template?.name || "Saved template")}</h2></div><label class="template-checkbox"><input type="checkbox" data-template-use-duration ${review.useDuration ? "checked" : ""} ${status.valid ? "" : "disabled"} /><span>Use the suggested ${Number(template?.durationMinutes) || 180} minute session length</span></label><p class="prep-help">Planning guidance stays separate from your authored details and prep checks.</p><div><button class="secondary-button" type="button" data-template-refresh-review ${template ? "" : "disabled"}>Refresh review</button></div></section></div>
    <div data-template-alert>${prepTemplateError || !status.valid ? `<div class="template-alert" role="alert"><strong>Review needs attention</strong><p>${esc(prepTemplateError || status.error)}</p><p>Refresh explicitly to rebuild the review. Your existing preparation remains saved.</p></div>` : ""}</div><div class="template-review-toolbar" data-template-review-toolbar>${prepTemplateReviewToolbar(context, status)}</div><div class="template-review-list">${review.rows.map(row => prepTemplateCandidateMarkup(row, status.valid)).join("")}</div></div>`;
}
function prepTemplateSaveEditor() {
  if (prepTemplateEditorSaved) prepTemplateEditor = prepTemplatesCore().saveTemplate(prepTemplateLibrary(), prepTemplateEditor);
  prepTemplateError = "";
  if (prepTemplateEditorSaved) saveState();
}
function prepTemplateNumber(field, fallback, commit) {
  if (!commit && (!field.value.trim() || !Number.isFinite(Number(field.value)))) return null;
  const value = Math.max(Number(field.min || 0), Math.min(Number(field.max || 1440), Math.round(field.value.trim() && Number.isFinite(Number(field.value)) ? Number(field.value) : fallback)));
  if (commit) field.value = String(value);
  return value;
}
function prepTemplateApplyEditorField(field, commit = false) {
  if (!prepTemplateEditor) return false;
  const key = field.dataset.templateEditorField, collection = field.dataset.templateCollection;
  let target = collection ? prepTemplateEditor[collection]?.[Number(field.dataset.templateIndex)] : prepTemplateEditor;
  if (!target) return false;
  const allowed = collection ? field.dataset.templatePrompt ? Object.keys(TEMPLATE_PROMPT_FIELDS[collection] || {}) : ["kind", "minutes", "max", "optional"] : ["name", "summary", "durationMinutes", "openingPrompt"];
  if (!allowed.includes(key)) return false;
  if (field.dataset.templatePrompt) target = target.prompts ||= {};
  const value = field.type === "checkbox" ? field.checked : field.type === "number" ? prepTemplateNumber(field, key === "durationMinutes" ? 180 : key === "max" ? 4 : 30, commit) : field.value;
  if (value === null || target[key] === value) return false;
  target[key] = value;
  if (collection && field.dataset.templatePrompt) {
    const row = prepTemplateEditor[collection][Number(field.dataset.templateIndex)];
    field.closest("[data-template-editor-row]").querySelector("[data-template-editor-row-title]").textContent = Object.values(row.prompts).find(value => String(value).trim()) || TEMPLATE_COLLECTIONS[collection];
  }
  return true;
}
function prepTemplateApplyReviewField(review, field, commit = false) {
  const row = review?.rows.find(row => row.id === field.dataset.templateReviewRow);
  const key = field.dataset.templateReviewField;
  if (!row) return false;
  const allowed = row.collection === "opening" ? ["opening"] : [...Object.keys(TEMPLATE_PROMPT_FIELDS[row.collection] || {}), ...(row.collection === "scenes" ? ["kind", "minutes"] : row.collection === "clocks" ? ["max"] : [])];
  if (!allowed.includes(key)) return false;
  const value = field.type === "number" ? prepTemplateNumber(field, key === "max" ? 4 : 30, commit) : field.value;
  if (value === null || row.after[key] === value) return false;
  row.after[key] = value;
  if (key === "minutes") field.closest("[data-template-candidate]").querySelector("[data-template-candidate-time]").textContent = `${value} suggested minutes`;
  return true;
}
function prepTemplateFlush(page) {
  let edited = false, reviewed = false;
  const review = prepTemplateReviewPrep(activeCampaign())?.templateReview;
  page.querySelectorAll("[data-template-editor-field]").forEach(field => { if (prepTemplateApplyEditorField(field, true)) edited = true; });
  page.querySelectorAll("[data-template-review-field]").forEach(field => { if (prepTemplateApplyReviewField(review, field, true)) reviewed = true; });
  if (edited) prepTemplateSaveEditor();
  if (reviewed) saveState();
}
function prepTemplateUpdateReview(page) {
  const context = prepTemplateReviewContext(activeCampaign());
  const toolbar = page.querySelector("[data-template-review-toolbar]");
  if (toolbar) toolbar.innerHTML = prepTemplateReviewToolbar(context, prepTemplateReviewStatus(context));
}
function prepTemplateStartEditor(template, saved = true) {
  const next = saved ? prepTemplatesCore().saveTemplate(prepTemplateLibrary(), template) : template;
  prepTemplateEditor = next;
  prepTemplateEditorSaved = saved;
  prepTemplateError = "";
  currentView = "prep-template-editor";
  if (saved) saveState();
  render();
}
function prepTemplateNewRow(collection) {
  const prompts = Object.fromEntries(Object.entries(TEMPLATE_PROMPT_FIELDS[collection]).map(([key, label]) => [key, `Prepare the ${label.toLocaleLowerCase()} for this session.`]));
  return { prompts, ...(collection === "scenes" ? { kind: "scene", minutes: 30 } : collection === "clocks" ? { max: 4 } : {}), optional: false };
}

const prepTemplateRoot = document.querySelector("#viewRoot");
prepTemplateRoot.addEventListener("input", event => {
  if (prepTemplatesBlocked()) return;
  const page = event.target.closest("[data-template-page]");
  if (!page) return;
  const field = event.target;
  try {
    if (field.matches("[data-template-search]")) {
      prepTemplateSearch = field.value;
      page.querySelector("[data-template-library-cards]").innerHTML = prepTemplateLibraryCards(activeCampaign());
    } else if (field.matches("[data-template-editor-field]") && prepTemplateApplyEditorField(field)) prepTemplateSaveEditor();
    else if (field.matches("[data-template-review-field]")) {
      const context = prepTemplateReviewContext(activeCampaign());
      if (prepTemplateReviewStatus(context).valid && prepTemplateApplyReviewField(context.review, field)) { prepTemplateError = ""; saveState(); prepTemplateUpdateReview(page); }
    }
  } catch (error) { prepTemplateError = error.message || "The template could not be saved."; page.querySelector("[data-template-alert]").innerHTML = prepTemplateAlertMarkup(); }
});
prepTemplateRoot.addEventListener("change", event => {
  if (prepTemplatesBlocked()) return;
  const page = event.target.closest("[data-template-page]");
  if (!page) return;
  const campaign = activeCampaign(), field = event.target;
  try {
    if (field.matches("[data-template-target]")) { prepTemplateRememberTarget(campaign, field.value ? sessionFromAction(campaign, field.value) : null); render(); return; }
    if (field.matches("[data-template-editor-field]") && prepTemplateApplyEditorField(field, true)) { prepTemplateSaveEditor(); return; }
    const context = prepTemplateReviewContext(campaign);
    if (!context.review || !prepTemplateReviewStatus(context).valid) return;
    if (field.matches("[data-template-include]")) {
      const row = context.review.rows.find(row => row.id === field.dataset.templateInclude);
      if (!row) return;
      row.selected = field.checked;
      field.closest("[data-template-candidate]").classList.toggle("is-selected", row.selected);
    } else if (field.matches("[data-template-use-duration]")) context.review.useDuration = field.checked;
    else if (!field.matches("[data-template-review-field]") || !prepTemplateApplyReviewField(context.review, field, true)) return;
    prepTemplateError = "";
    saveState();
    prepTemplateUpdateReview(page);
  } catch (error) { prepTemplateError = error.message || "The review could not be saved."; page.querySelector("[data-template-alert]").innerHTML = prepTemplateAlertMarkup(); }
});
prepTemplateRoot.addEventListener("click", event => {
  const button = event.target.closest("button");
  const page = event.target.closest("[data-template-page]");
  if (!button || !page || prepTemplatesBlocked()) return;
  const action = ["back", "library", "new", "capture", "edit", "copy", "delete", "review", "editor-review", "save-capture", "row-add", "row-remove", "row-move", "clear-review", "refresh-review", "apply"].find(action => button.hasAttribute(`data-template-${action}`));
  if (!action) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const campaign = activeCampaign();
  try {
    prepTemplateFlush(page);
    const session = prepTemplateSession(campaign);
    if (action === "back" || action === "library") {
      if (currentView === "prep-template-editor" && !prepTemplateEditorSaved && !confirm("Leave this captured template without saving it to your library?")) return;
      if (action === "back") { if (session) openSessionPrep(campaign, session); else { currentView = "sessions"; render(); } }
      else { currentView = "prep-templates"; prepTemplateError = ""; render(); }
      return;
    }
    if (action === "new") { prepTemplateStartEditor(prepTemplatesCore().createTemplate({ name: "My prep template", summary: "", durationMinutes: 180 })); return; }
    if (action === "capture") { if (session) openPrepTemplateCapture(campaign, session); return; }
    if (action === "edit" || action === "copy" || action === "delete" || action === "review") {
      const template = prepTemplateFind(button.getAttribute(`data-template-${action}`));
      if (!template) throw new Error("This template is unavailable. Return to the library and choose another.");
      if (action === "review") { if (session) openPrepTemplateReview(campaign, session, template.id); return; }
      if (action === "copy") { prepTemplateStartEditor(prepTemplatesCore().duplicateTemplate(template, { name: `${template.name} copy` })); return; }
      if (template.builtin) throw new Error("Make an editable copy of this built-in structure first.");
      if (action === "edit") { prepTemplateStartEditor(structuredClone(template)); return; }
      if (!confirm(`Delete “${template.name}” from your reusable library? Existing session prep keeps its applied copies.`)) return;
      prepTemplatesCore().deleteTemplate(prepTemplateLibrary(), template.id);
      saveState(); render(); return;
    }
    if (action === "save-capture") { prepTemplateStartEditor(prepTemplateEditor); showToast("Reusable template saved to your library."); return; }
    if (action === "editor-review") { if (session) openPrepTemplateReview(campaign, session, prepTemplateEditor.id); return; }
    if (["row-add", "row-remove", "row-move"].includes(action)) {
      const [collection, indexText] = button.getAttribute(`data-template-${action}`).split(":"), index = Number(indexText);
      if (!TEMPLATE_COLLECTIONS[collection] || !prepTemplateEditor) return;
      const rows = prepTemplateEditor[collection] ||= [];
      if (action === "row-add") rows.push(prepTemplateNewRow(collection));
      else if (action === "row-remove") rows.splice(index, 1);
      else { const next = index + (button.dataset.templateDirection === "-1" ? -1 : 1); if (index < 0 || next < 0 || next >= rows.length) return; [rows[index], rows[next]] = [rows[next], rows[index]]; }
      prepTemplateSaveEditor(); render(); return;
    }
    const context = prepTemplateReviewContext(campaign);
    if (!context.review || !context.session) return;
    if (action === "refresh-review") {
      if (!context.template) throw new Error("Choose an available template from your library.");
      if (prepTemplateReviewHasEdits(context.review) && !confirm("Refresh this review and discard its saved selections and session writing? Existing prep remains saved.")) return;
      context.prep.templateReview = prepTemplateReviewBaseline(prepTemplatesCore().buildReview(campaign, context.session, context.template));
      prepTemplateError = ""; saveState(); render(); return;
    }
    const status = prepTemplateReviewStatus(context);
    if (!status.valid) throw new Error(status.error);
    if (action === "clear-review") {
      context.review.rows.forEach(row => { row.selected = false; });
      context.review.useDuration = false;
      saveState(); render(); return;
    }
    if (action === "apply") {
      const result = prepTemplatesCore().applyReview(campaign, context.session, context.template, context.review);
      saveState();
      openSessionPrep(campaign, context.session);
      showToast(`${result.added.length} ${result.added.length === 1 ? "planning prompt" : "planning prompts"} added to session prep.`);
    }
  } catch (error) { prepTemplateError = error.message || "The template could not be updated. Your saved preparation remains available."; render(); }
}, true);
