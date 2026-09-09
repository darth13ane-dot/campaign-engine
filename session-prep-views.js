/* GM-only session preparation. App integration stays in app.js. */
let activeSessionPrepId = null;

function sessionPrepCore() { return window.CampaignSessionPrep; }
function activeSessionPrep(campaign = activeCampaign()) {
  return campaign.sessionWorkflow?.preps?.[activeSessionPrepId] || null;
}
function openSessionPrep(campaign, session) {
  if (playerPreviewActive() || !session || !sessionPrepCore()) return;
  SESSION_WORKFLOW.ensureWorkflow(campaign);
  activeSessionPrepId = sessionPrepCore().ensurePrep(campaign, session).id;
  currentView = "session-prep";
  saveState();
  render();
}

function prepRecordLists(campaign) {
  return { character: campaign.characters, quest: campaign.quests, location: campaign.locations, journal: campaign.journal, arc: campaign.arcs };
}
function prepRecordRef(type, record) {
  const ref = { type, name: String(record.name || record.title || "") };
  ["archivistId", "localId", "id"].forEach(key => { if (record[key]) ref[key] = record[key]; });
  return ref;
}
function prepRecordKey(ref) {
  const identity = ["archivistId", "localId", "id"].find(key => ref[key]);
  return `${ref.type}:${identity ? `${identity}:${ref[identity]}` : `name:${ref.name}`}`;
}
function prepResolveRecord(campaign, ref) {
  return sessionPrepCore().resolvePinnedRecord(campaign, ref);
}
function prepNameIsUnique(campaign, ref) {
  const records = ref.type === "session" ? campaign.sessions : prepRecordLists(campaign)[ref.type];
  const name = String(ref.name || "").toLocaleLowerCase();
  return (records || []).filter(record => String(record.name || record.title || "").toLocaleLowerCase() === name).length === 1;
}
function prepPinnedRecordDetails(record, summary = "Saved details for this pinned record") {
  const fields = [["Role", record.role], ["Status", record.status], ["Overview", record.description], ["Details", record.detail], ["Journal entry", record.body], ["Session notes", record.recap], ["Pressure", record.tension], ["Next step", record.nextStep], ["Voice", record.voice], ["Quirks", record.quirks], ["Relationships", record.relationships], ["Stats", record.statBlock], ["Tags", record.tags], ["Factions", record.factions]];
  const content = fields.filter(([, value]) => value != null && String(value).trim()).map(([label, value]) => {
    const text = Array.isArray(value) ? value.join(", ") : typeof value === "object" ? JSON.stringify(value, null, 2) : String(value);
    return `<p><strong>${esc(label)}</strong><br />${esc(text)}</p>`;
  }).join("");
  return `<details class="prep-existing-body"><summary>${esc(summary)}</summary>${content || `<p>No additional details are saved for this record.</p>`}</details>`;
}
function prepAvailableRecords(campaign, prep, query = "") {
  const pinned = new Set(prep.pinned.map(prepRecordKey));
  const search = query.toLocaleLowerCase().trim();
  return Object.entries(prepRecordLists(campaign)).flatMap(([type, records]) => (records || []).map(record => prepRecordRef(type, record)))
    .filter(ref => ref.name && !pinned.has(prepRecordKey(ref)) && (!search || `${ref.name} ${ENTRY_TYPES[ref.type] || ref.type}`.toLocaleLowerCase().includes(search)))
    .sort((a, b) => a.name.localeCompare(b.name));
}
function prepPinOptions(campaign, prep, query = "") {
  const entries = prepAvailableRecords(campaign, prep, query);
  return `<option value="">${entries.length ? "Choose a campaign record…" : "No matching records"}</option>${entries.map(entry => `<option value="${esc(encodeURIComponent(JSON.stringify(entry)))}">${esc(ENTRY_TYPES[entry.type] || entry.type)} · ${esc(entry.name)}</option>`).join("")}`;
}
function prepField(collection, id, field) {
  return `data-prep-field="${esc(field)}"${collection ? ` data-prep-collection="${esc(collection)}" data-prep-row="${esc(id)}"` : ""}`;
}
function prepRemove(collection, id, label) {
  return `<button class="prep-icon-button prep-remove" type="button" data-prep-remove="${esc(id)}" data-prep-collection="${esc(collection)}" aria-label="Remove ${esc(label)}" title="Remove ${esc(label)}">×</button>`;
}
function prepTimeCopy(status) {
  const remaining = status.durationMinutes - status.plannedMinutes;
  return remaining < 0 ? `${Math.abs(remaining)} min over your session budget` : remaining === 0 ? "Your scene outline fills the session budget" : `${remaining} min available for breaks and improvisation`;
}
function prepReadinessMarkup(prep, campaign) {
  const status = sessionPrepCore().readiness(prep, campaign);
  return `<div class="prep-readiness-heading"><div><p class="eyebrow">PREP CHECK</p><strong>${status.complete} of ${status.total} prompts covered</strong></div><span class="prep-readiness-fraction">${status.total ? Math.round(status.complete / status.total * 100) : 0}%</span></div>
    <progress value="${status.complete}" max="${Math.max(1, status.total)}" aria-label="Prep prompts covered"></progress>
    <ul class="prep-readiness-checks">${status.checks.map(check => `<li class="${check.done ? "is-done" : ""}"><span aria-hidden="true">${check.done ? "✓" : "○"}</span>${esc(check.label)}</li>`).join("")}</ul><p class="prep-help">Use these prompts to judge what your table needs. You can start play at any point.</p>`;
}
function prepProvenanceMarkup(campaign, item) {
  if (playerPreviewActive()) return "";
  const source = sessionPrepCore().describeProvenance(campaign, item?.provenance);
  if (!source) return "";
  return `<details class="prep-provenance"><summary>From ${esc(source.label)}${source.missing ? ` <span>· source unavailable</span>` : ""}</summary><div class="prep-provenance-body"><p>${esc(source.context)}</p>${source.record ? prepPinnedRecordDetails(source.record, "Saved details for this source record") : ""}${source.desk ? `<button class="secondary-button" type="button" data-open-session-desk="${esc(source.desk.id)}">Open source session log</button>` : ""}${source.session && !source.desk && source.session.recap ? `<details class="prep-existing-body"><summary>Saved source session notes</summary><p>${esc(source.session.recap)}</p></details>` : ""}</div></details>`;
}
function prepSceneMarkup(scene, index, total, campaign) {
  const kinds = { scene: "Scene", social: "Social", exploration: "Exploration", combat: "Combat", pressure: "Pressure" };
  return `<article class="prep-scene" data-prep-card="${esc(scene.id)}">
    <div class="prep-scene-heading"><span class="prep-scene-number">${String(index + 1).padStart(2, "0")}</span><label class="prep-scene-title">Scene title<input ${prepField("scenes", scene.id, "title")} maxlength="240" value="${esc(scene.title)}" placeholder="The first meaningful situation" /></label><div class="prep-row-actions"><button class="prep-icon-button" type="button" data-prep-move="${esc(scene.id)}" data-prep-direction="-1" aria-label="Move scene ${index + 1} up" title="Move up" ${index === 0 ? "disabled" : ""}>↑</button><button class="prep-icon-button" type="button" data-prep-move="${esc(scene.id)}" data-prep-direction="1" aria-label="Move scene ${index + 1} down" title="Move down" ${index === total - 1 ? "disabled" : ""}>↓</button>${prepRemove("scenes", scene.id, `scene ${index + 1}`)}</div></div>
    <div class="prep-scene-settings"><label>Scene type<select ${prepField("scenes", scene.id, "kind")}>${Object.entries(kinds).map(([kind, label]) => `<option value="${kind}"${scene.kind === kind ? " selected" : ""}>${label}</option>`).join("")}</select></label><label>Estimated minutes<input ${prepField("scenes", scene.id, "minutes")} type="number" min="0" max="1440" step="5" value="${esc(scene.minutes)}" /></label></div>
    <label>Situation & useful details<textarea ${prepField("scenes", scene.id, "detail")} rows="3" maxlength="6000" placeholder="Who wants what? What can the characters interact with? Add stakes, cues, and useful rules here.">${esc(scene.detail || "")}</textarea></label>
    <label>Meaningful question or choice<textarea ${prepField("scenes", scene.id, "question")} rows="2" maxlength="1000" placeholder="What can the players decide, discover, or change?">${esc(scene.question || "")}</textarea></label>
    ${prepProvenanceMarkup(campaign, scene)}
  </article>`;
}
function prepPinnedMarkup(campaign, prep) {
  if (!prep.pinned.length) return `<p class="prep-empty">Keep the people, places, quests, story arcs, and notes you expect to need within reach.</p>`;
  return prep.pinned.map((entry, index) => {
    const record = prepResolveRecord(campaign, entry);
    const current = record ? prepRecordRef(entry.type, record) : entry;
    const uniqueName = record && prepNameIsUnique(campaign, current);
    const excerpt = String(record?.description || record?.detail || record?.body || record?.tension || "").replace(/<[^>]+>/g, " ").slice(0, 180);
    return `<article class="prep-pin"><div><small>${esc(ENTRY_TYPES[entry.type] || entry.type)}</small>${uniqueName ? `<button type="button" class="prep-record-link" ${deskEntryAction(current)}>${esc(current.name)}</button>` : `<strong>${esc(current.name)}</strong>`}${excerpt ? `<p>${esc(excerpt)}</p>` : ""}${record && !uniqueName ? `<p class="prep-help">Several records share this name. Expand the saved details of your pinned record below.</p>${prepPinnedRecordDetails(record)}` : ""}${!record ? `<p class="prep-help">This record is unavailable. Its reference remains in this plan.</p>` : ""}${prepProvenanceMarkup(campaign, entry)}</div><button class="prep-icon-button prep-remove" type="button" data-prep-unpin="${index}" aria-label="Unpin ${esc(current.name)}" title="Unpin record">×</button></article>`;
  }).join("");
}

function sessionPrepView(campaign) {
  if (playerPreviewActive()) return playerPreviewRestrictedView();
  const prep = activeSessionPrep(campaign);
  const session = prep && sessionPrepCore().findSession(campaign, prep.sessionRef);
  if (!prep || !session) return `<div class="empty-state"><h2>This session plan is unavailable.</h2><p>Open a session from the campaign's session list to prepare it.</p><button class="primary-button" type="button" data-view-jump="sessions">Back to sessions</button></div>`;
  const status = sessionPrepCore().readiness(prep, campaign);
  const desk = SESSION_WORKFLOW.findDeskForSession(campaign, session);
  const liveLabel = desk?.status === "active" ? "Resume live session" : desk?.status === "ended" ? "Review consequences" : "Start live session";
  const characters = (campaign.characters || []).filter(character => /^PC\b/i.test(character.role || "") || (Array.isArray(character.tags) && character.tags.some(tag => ["party", "pc", "player character"].includes(String(tag).toLowerCase()))));
  const missingPins = prep.pinned.filter(entry => !prepResolveRecord(campaign, entry)).length;
  const directions = (Array.isArray(session.directions) ? session.directions : []).map(value => String(value || "")).filter(value => value.trim());
  return `<div class="session-prep-page" data-prep-id="${esc(prep.id)}">
    ${header(session.title, `SESSION PREP · ${esc(campaign.system || "YOUR CAMPAIGN")}`, "Shape the situations, choices, and discoveries that make the next session worth playing.", `<div class="header-actions prep-header-actions"><button class="secondary-button" type="button" data-view-jump="sessions">Sessions</button>${window.CampaignPrepContinuity ? `<button class="secondary-button" type="button" data-open-prep-continuity="${esc(sessionActionRef(session))}">Bring forward</button>` : ""}${playerPacketAction(session)}<button class="secondary-button" type="button" data-prep-export>GM Markdown packet</button><button class="primary-button" type="button" data-start-session-desk="${esc(sessionActionRef(session))}">${liveLabel} <span>→</span></button></div>`)}
    <div class="prep-context-bar"><span>Session ${esc(session.number || "—")}${session.date ? ` · ${esc(session.date)}` : ""}</span><span class="save-hint" data-save-status>Saved</span></div>
    ${session.recap || directions.length ? `<details class="card prep-existing-notes"><summary>Existing session notes${directions.length ? ` · ${directions.length} possible directions` : ""}</summary><div class="prep-existing-body">${session.recap ? `<p>${esc(session.recap)}</p>` : ""}${directions.length ? `<h3>Possible directions</h3><ul>${directions.map(direction => `<li>${esc(direction)}</li>`).join("")}</ul>` : ""}${prepNameIsUnique(campaign, { type: "session", name: session.title }) ? `<button class="secondary-button" type="button" ${deskEntryAction({ type: "session", name: session.title })}>Open session notes</button>` : `<p class="prep-help">Several sessions share this title. The notes shown here belong to this prepared session.</p>`}</div></details>` : ""}
    ${desk ? `<p class="prep-live-notice">${desk.status === "active" ? "Your live desk has its own copy of the plan. These edits save to prep; continue tracking play in the live desk." : "This session has finished. You can keep refining its prep notes and review the recorded consequences."}</p>` : ""}
    <div class="prep-overview-grid"><section class="card prep-panel prep-opening"><div class="section-title"><div><p class="eyebrow">FIRST FIVE MINUTES</p><h2>Opening situation</h2></div></div><label class="prep-visually-labelled">What puts the session in motion?<textarea ${prepField(null, null, "opening")} rows="5" maxlength="6000" placeholder="Begin with a concrete situation: what the characters see, what is changing, and the first decision in front of them.">${esc(prep.opening || "")}</textarea></label><div class="prep-budget-row"><label>Session length (minutes)<input ${prepField(null, null, "durationMinutes")} type="number" min="15" max="1440" step="15" value="${esc(prep.durationMinutes)}" /></label><div class="prep-budget-copy"><strong data-prep-time-total>${status.plannedMinutes} min in scenes</strong><span data-prep-time-note class="${status.plannedMinutes > status.durationMinutes ? "prep-over-budget" : ""}">${esc(prepTimeCopy(status))}</span></div></div></section><aside class="card prep-panel prep-readiness" data-prep-readiness aria-live="off">${prepReadinessMarkup(prep, campaign)}</aside></div>
    <div class="prep-workspace-grid"><div class="prep-outline"><section class="card prep-panel"><div class="section-title"><div><p class="eyebrow">FLEXIBLE RUN OF PLAY</p><h2>Scene outline</h2></div><span class="tag">${prep.scenes.length} scenes</span></div><p class="prep-help">Prepare situations and meaningful choices. Reorder the outline as your session takes shape.</p><div class="prep-scene-list">${prep.scenes.length ? prep.scenes.map((scene, index) => prepSceneMarkup(scene, index, prep.scenes.length, campaign)).join("") : `<div class="prep-empty prep-empty-scene"><strong>Give the table its first situation.</strong><p>Add a scene with a clear pressure or opportunity, the details you need, and a question the players can answer.</p></div>`}</div><button class="secondary-button prep-add-button" type="button" data-prep-add="scenes">＋ Add scene</button></section>
      <section class="card prep-panel"><div class="section-title"><div><p class="eyebrow">EVERY CHARACTER MATTERS</p><h2>Spotlight opportunities</h2></div></div><p class="prep-help">Prepare a moment that speaks to a character's goals, abilities, or relationships.</p><datalist id="prepCharacterNames">${characters.map(character => `<option value="${esc(character.name)}"></option>`).join("")}</datalist><div class="prep-item-list">${prep.spotlights.length ? prep.spotlights.map(item => `<article class="prep-spotlight" data-prep-card="${esc(item.id)}"><div class="prep-inline-heading"><label>Character<input ${prepField("spotlights", item.id, "character")} maxlength="200" list="prepCharacterNames" value="${esc(item.character || "")}" placeholder="Choose or type a character name" /></label>${prepRemove("spotlights", item.id, "spotlight")}</div><label>Opportunity<textarea ${prepField("spotlights", item.id, "opportunity")} rows="2" maxlength="2000" placeholder="A bond to test, a skill to use, a lead toward a personal goal…">${esc(item.opportunity || "")}</textarea></label>${prepProvenanceMarkup(campaign, item)}</article>`).join("") : `<p class="prep-empty">Who deserves a moment this session? Add a character and an opportunity you can bring into play.</p>`}</div><button class="secondary-button prep-add-button" type="button" data-prep-add="spotlights">＋ Add spotlight</button></section></div>
      <aside class="prep-support"><section class="card prep-panel"><div class="section-title"><div><p class="eyebrow">CAMPAIGN AT HAND</p><h2>Pinned references</h2></div>${missingPins ? `<span class="tag">${missingPins} unavailable</span>` : ""}</div><div class="prep-pin-list">${prepPinnedMarkup(campaign, prep)}</div><form class="prep-pin-form" data-prep-pin-form><label>Find a campaign record<input data-prep-pin-search type="search" placeholder="Search people, places, quests…" /></label><label>Record<select name="entry" required>${prepPinOptions(campaign, prep)}</select></label><button class="secondary-button" type="submit">Pin reference</button></form></section>
      <section class="card prep-panel"><div class="section-title"><div><p class="eyebrow">CLUES TO PUT IN PLAY</p><h2>Secrets & revelations</h2></div></div><div class="prep-item-list">${prep.revelations.length ? prep.revelations.map(item => `<article class="prep-row-group" data-prep-card="${esc(item.id)}"><div class="prep-text-row"><label class="prep-grow">Revelation<textarea ${prepField("revelations", item.id, "text")} rows="2" maxlength="1000" placeholder="What useful truth might the characters discover?">${esc(item.text || "")}</textarea></label>${prepRemove("revelations", item.id, "revelation")}</div>${prepProvenanceMarkup(campaign, item)}</article>`).join("") : `<p class="prep-empty">Write discoveries you can reveal through conversation, exploration, or consequences.</p>`}</div><button class="secondary-button prep-add-button" type="button" data-prep-add="revelations">＋ Add revelation</button></section>
      <section class="card prep-panel"><div class="section-title"><div><p class="eyebrow">WHAT ADVANCES</p><h2>Clocks & counters</h2></div></div><p class="prep-help">Track faction plans, approaching danger, or progress. Set the starting value for play.</p><div class="prep-item-list">${prep.clocks.length ? prep.clocks.map(item => `<article class="prep-clock" data-prep-card="${esc(item.id)}"><div class="prep-inline-heading"><label>Clock or counter<input ${prepField("clocks", item.id, "label")} maxlength="160" value="${esc(item.label || "")}" placeholder="The watch closes in" /></label>${prepRemove("clocks", item.id, "clock")}</div><div class="prep-clock-values"><label>Starting value<input ${prepField("clocks", item.id, "value")} type="number" min="0" max="${esc(item.max)}" value="${esc(item.value)}" /></label><label>Segments / maximum<input ${prepField("clocks", item.id, "max")} type="number" min="1" max="20" value="${esc(item.max)}" /></label></div>${prepProvenanceMarkup(campaign, item)}</article>`).join("") : `<p class="prep-empty">Add a pressure that moves when time passes or the characters act.</p>`}</div><button class="secondary-button prep-add-button" type="button" data-prep-add="clocks">＋ Add clock</button></section>
      <section class="card prep-panel"><div class="section-title"><div><p class="eyebrow">BEFORE THE TABLE</p><h2>Prep tasks</h2></div></div><div class="prep-item-list">${prep.tasks.length ? prep.tasks.map(item => `<article class="prep-row-group" data-prep-card="${esc(item.id)}"><div class="prep-task ${item.done ? "is-done" : ""}"><input ${prepField("tasks", item.id, "done")} type="checkbox" ${item.done ? "checked" : ""} aria-label="Mark prep task complete" /><label class="prep-grow"><span class="sr-only">Prep task</span><input ${prepField("tasks", item.id, "text")} maxlength="500" value="${esc(item.text || "")}" placeholder="Prepare a map, read a rule, choose music…" /></label>${prepRemove("tasks", item.id, "task")}</div>${prepProvenanceMarkup(campaign, item)}</article>`).join("") : `<p class="prep-empty">Keep the remaining work here: maps, handouts, rules checks, and table logistics.</p>`}</div><button class="secondary-button prep-add-button" type="button" data-prep-add="tasks">＋ Add task</button></section></aside></div>
  </div>`;
}

function prepUpdateSummary(prep, campaign = activeCampaign()) {
  const page = document.querySelector(".session-prep-page");
  if (!page || page.dataset.prepId !== prep.id) return;
  const status = sessionPrepCore().readiness(prep, campaign);
  page.querySelector("[data-prep-time-total]").textContent = `${status.plannedMinutes} min in scenes`;
  const note = page.querySelector("[data-prep-time-note]");
  note.textContent = prepTimeCopy(status);
  note.classList.toggle("prep-over-budget", status.plannedMinutes > status.durationMinutes);
  page.querySelector("[data-prep-readiness]").innerHTML = prepReadinessMarkup(prep, campaign);
}
function prepApplyField(prep, field, commitNumbers = false) {
  const allowed = { scenes: ["title", "kind", "minutes", "detail", "question"], spotlights: ["character", "opportunity"], revelations: ["text"], clocks: ["label", "max", "value"], tasks: ["text", "done"] };
  const collection = field.dataset.prepCollection;
  const key = field.dataset.prepField;
  if (collection ? !allowed[collection]?.includes(key) : !["opening", "durationMinutes"].includes(key)) return false;
  const target = collection ? prep[collection].find(item => item.id === field.dataset.prepRow) : prep;
  if (!target) return false;
  let value = field.type === "checkbox" ? field.checked : field.value;
  if (field.type === "number") {
    if (!commitNumbers && (!String(value).trim() || !Number.isFinite(Number(value)))) return false;
    const fallback = key === "durationMinutes" ? 180 : key === "max" ? 4 : 0;
    const min = key === "durationMinutes" ? 15 : key === "max" ? 1 : 0;
    const max = key === "max" ? 20 : key === "value" ? target.max : 1440;
    value = Math.max(min, Math.min(max, Math.round(String(value).trim() && Number.isFinite(Number(value)) ? Number(value) : fallback)));
    if (commitNumbers) field.value = String(value);
  }
  if (key === "kind" && !["scene", "social", "exploration", "combat", "pressure"].includes(value)) return false;
  const changed = target[key] !== value;
  target[key] = value;
  if (collection === "tasks") field.closest(".prep-task")?.classList.toggle("is-done", target.done);
  if (collection === "clocks" && key === "max") {
    target.value = Math.min(target.value, value);
    const valueField = field.closest(".prep-clock")?.querySelector('[data-prep-field="value"]');
    if (valueField) { valueField.max = String(value); valueField.value = String(target.value); }
  }
  return changed;
}
function prepFlushFields(prep) {
  const page = document.querySelector(".session-prep-page");
  if (!page || page.dataset.prepId !== prep.id) return;
  let changed = false;
  page.querySelectorAll("[data-prep-field]").forEach(field => { if (prepApplyField(prep, field, true)) changed = true; });
  if (changed) { prep.updatedAt = new Date().toISOString(); saveState(); }
}
function prepFocusRow(id) {
  const row = Array.from(document.querySelectorAll("[data-prep-card]")).find(card => card.dataset.prepCard === id);
  row?.querySelector('input:not([type="checkbox"]), textarea')?.focus();
}
function prepEventContext(event) {
  if (playerPreviewActive()) return null;
  const page = event.target.closest(".session-prep-page");
  const campaign = activeCampaign();
  const prep = activeSessionPrep(campaign);
  return page && prep && page.dataset.prepId === prep.id ? { campaign, prep, page } : null;
}

const sessionPrepRoot = document.querySelector("#viewRoot");
sessionPrepRoot.addEventListener("input", event => {
  const context = prepEventContext(event);
  if (!context) return;
  const field = event.target.closest("[data-prep-field]");
  if (field && prepApplyField(context.prep, field)) {
    context.prep.updatedAt = new Date().toISOString();
    saveState();
    prepUpdateSummary(context.prep);
  }
  if (event.target.matches("[data-prep-pin-search]")) {
    const select = event.target.form.elements.entry;
    const previous = select.value;
    select.innerHTML = prepPinOptions(context.campaign, context.prep, event.target.value);
    if (Array.from(select.options).some(option => option.value === previous)) select.value = previous;
  }
});
sessionPrepRoot.addEventListener("change", event => {
  const context = prepEventContext(event);
  const field = event.target.closest("[data-prep-field]");
  if (!context || !field) return;
  if (prepApplyField(context.prep, field, true)) { context.prep.updatedAt = new Date().toISOString(); saveState(); }
  prepUpdateSummary(context.prep);
});
// Capture pending input before navigation or any structural render replaces its field.
sessionPrepRoot.addEventListener("click", event => {
  const context = prepEventContext(event);
  if (!context) return;
  const button = event.target.closest("button");
  if (!button) return;
  const { campaign, prep } = context;
  prepFlushFields(prep);
  const add = button.dataset.prepAdd;
  const remove = button.dataset.prepRemove;
  const move = button.dataset.prepMove;
  if (!add && !remove && !move && !button.hasAttribute("data-prep-unpin") && !button.hasAttribute("data-prep-export")) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  let focusId = null;
  if (add) {
    const id = sessionPrepCore().createId(add);
    const defaults = { scenes: { id, title: "", kind: "scene", minutes: 30, detail: "", question: "" }, revelations: { id, text: "", checked: false }, clocks: { id, label: "", value: 0, max: 4 }, spotlights: { id, character: "", opportunity: "" }, tasks: { id, text: "", done: false } };
    if (!Object.hasOwn(defaults, add)) return;
    prep[add].push(defaults[add]);
    focusId = id;
  } else if (remove) {
    const collection = button.dataset.prepCollection;
    if (!["scenes", "revelations", "clocks", "spotlights", "tasks"].includes(collection)) return;
    prep[collection] = prep[collection].filter(item => item.id !== remove);
  } else if (move) {
    const index = prep.scenes.findIndex(scene => scene.id === move);
    const next = index + (button.dataset.prepDirection === "-1" ? -1 : 1);
    if (index < 0 || next < 0 || next >= prep.scenes.length) return;
    [prep.scenes[index], prep.scenes[next]] = [prep.scenes[next], prep.scenes[index]];
    focusId = move;
  } else if (button.hasAttribute("data-prep-unpin")) {
    const index = Number(button.dataset.prepUnpin);
    if (Number.isInteger(index) && index >= 0 && index < prep.pinned.length) prep.pinned.splice(index, 1);
  } else if (button.hasAttribute("data-prep-export")) {
    const session = sessionPrepCore().findSession(campaign, prep.sessionRef);
    if (!session) { showToast("This session could not be found."); return; }
    const blob = new Blob([sessionPrepCore().exportMarkdown(campaign, session, prep)], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${String(campaign.title || "campaign").replace(/[^\p{L}\p{N} _-]/gu, "").trim().slice(0, 65) || "campaign"}-session-${session.number || "prep"}-gm-packet.md`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast("GM prep packet exported.");
    return;
  }
  prep.updatedAt = new Date().toISOString();
  saveState();
  render();
  if (focusId) prepFocusRow(focusId);
}, true);
sessionPrepRoot.addEventListener("submit", event => {
  if (!event.target.matches("[data-prep-pin-form]")) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const context = prepEventContext(event);
  if (!context) return;
  const { campaign, prep } = context;
  prepFlushFields(prep);
  let entry;
  try { entry = JSON.parse(decodeURIComponent(event.target.elements.entry.value)); } catch { return; }
  const available = prepAvailableRecords(campaign, prep).find(ref => prepRecordKey(ref) === prepRecordKey(entry));
  if (!available) return;
  prep.pinned.push(available);
  prep.updatedAt = new Date().toISOString();
  saveState();
  render();
}, true);
