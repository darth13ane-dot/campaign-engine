/* Source-scoped session drafting. Only reviewed pieces enter preparation. */
let prepNotesTarget = null;
let prepNotesSearch = "";
let prepNotesError = "";
let prepNotesRequest = null;
const NOTES_LABELS = { opening: "Opening", scenes: "Scene", revelations: "Clue / revelation", spotlights: "Character spotlight", clocks: "Clock", tasks: "Prep task" };
const NOTES_FIELDS = { opening: "Opening situation", title: "Scene title", detail: "Situation, pressure & useful details", question: "Meaningful player choice", text: "Text", character: "Character", opportunity: "Spotlight opportunity", label: "Clock label" };
function prepNotesCore() { return window.CampaignPrepNotes; }
function prepNotesBlocked() { return playerPreviewActive() || workspaceReplacementPending(); }
function prepNotesContext() {
  const campaign = activeCampaign();
  if (!prepNotesTarget || prepNotesTarget.campaignId !== campaign?.id) throw new Error("Open Build from notes from the session you want to prepare.");
  const session = sessionPrepCore().findSession(campaign, prepNotesTarget.sessionRef);
  if (!session) throw new Error("This session is unavailable. Its saved draft remains in the workspace.");
  return { campaign, session, prep: sessionPrepCore().findPrepForSession(campaign, session), book: prepNotesCore().ensureWorkbench(campaign, session) };
}
function openPrepNotes(campaign, session) {
  if (prepNotesBlocked() || !session) return;
  window.CampaignHistory.ensureIds(campaign);
  SESSION_WORKFLOW.ensureWorkflow(campaign);
  sessionPrepCore().ensurePrep(campaign, session);
  prepNotesTarget = { campaignId: campaign.id, sessionRef: sessionPrepCore().sessionReference(session) };
  prepNotesSearch = ""; prepNotesError = "";
  try {
    const book = prepNotesCore().ensureWorkbench(campaign, session);
    if (!book.sources.length && !book.draft && prepNotesCore().recordText(session)) prepNotesCore().addSource(campaign, session, { ...prepNotesTarget.sessionRef, type: "session" });
    saveState();
  } catch (error) { prepNotesError = error.message; }
  currentView = "prep-notes"; render();
}
function prepNotesOptions(campaign) {
  const all = prepNotesCore().listRecords(campaign, prepNotesSearch);
  return `<option value="">Choose a record${all.length > 100 ? " · first 100 matches; refine the search" : ""}…</option>${all.slice(0, 100).map(({ ref }) => `<option value="${esc(encodeURIComponent(JSON.stringify(ref)))}">${esc(ENTRY_TYPES[ref.type] || ref.type)} · ${esc(ref.name)} · ${esc(String(ref.archivistId || ref.localId || ref.id).slice(-8))}</option>`).join("")}`;
}
function prepNotesSourceMarkup(campaign, source) {
  const status = prepNotesCore().sourceStatus(campaign, source);
  return `<article class="notes-source" data-notes-source="${esc(source.id)}"><div class="notes-row-heading"><strong>${esc(source.label)}</strong><button class="prep-icon-button" type="button" data-notes-remove-source="${esc(source.id)}" aria-label="Remove source ${esc(source.label)}">×</button></div>${!status.valid ? `<p class="notes-warning">${esc(status.error)}</p>` : ""}${source.fullLength > 6000 ? `<p class="prep-help">This record has ${source.fullLength} characters. The first 6000 are selected; use a shorter exact passage from the record for focused drafting.</p>` : ""}<label>Selected excerpt<textarea rows="6" maxlength="6000" data-notes-source-text="${esc(source.id)}" placeholder="Paste the notes you want to turn into playable situations.">${esc(source.text)}</textarea></label>${source.ref ? `<details><summary>Current record & source tools</summary><p class="notes-source-original">${esc(prepNotesCore().recordText(prepResolveRecord(campaign, source.ref)))}</p><button class="secondary-button" type="button" data-notes-refresh-source="${esc(source.id)}">Use current record text</button></details>` : `<p class="prep-help">Your own notes, saved only in this preparation workspace.</p>`}</article>`;
}
function prepNotesEvidenceMarkup(row, book) {
  return `<details class="notes-evidence" open><summary>Source quotes & suggested additions</summary><p class="prep-help">Check that the prepared piece follows from these excerpts. Review any new facts or assumptions before adding it to your plan.</p>${row.evidence.map((entry, index) => `<div class="notes-quote"><label>Source<select data-notes-evidence-source="${index}" data-notes-row="${esc(row.id)}">${!book.sources.some(source => source.id === entry.sourceId) ? `<option value="">Source unavailable</option>` : ""}${book.sources.map(source => `<option value="${esc(source.id)}"${source.id === entry.sourceId ? " selected" : ""}>${esc(source.label)}</option>`).join("")}</select></label><label>Exact quote<textarea rows="2" maxlength="1000" data-notes-evidence-quote="${index}" data-notes-row="${esc(row.id)}">${esc(entry.quote)}</textarea></label><button type="button" class="quiet-button" data-notes-remove-quote="${index}" data-notes-row="${esc(row.id)}">Remove quote</button></div>`).join("")}<button type="button" class="quiet-button" data-notes-add-quote="${esc(row.id)}">＋ Source quote</button><label>Suggested additions / assumptions<textarea rows="2" maxlength="2000" data-notes-additions="${esc(row.id)}" placeholder="Name any new details you are proposing, or facts to verify.">${esc(row.additions)}</textarea></label></details>`;
}
function prepNotesRowMarkup(row, book, index) {
  const fields = Object.entries(prepNotesCore().FIELDS[row.collection] || {}).map(([key, limit]) => `<label>${NOTES_FIELDS[key]}${["title", "character", "label"].includes(key) ? `<input maxlength="${limit}" data-notes-field="${key}" data-notes-row="${esc(row.id)}" value="${esc(row.after[key])}" />` : `<textarea rows="${key === "detail" || key === "opening" ? 4 : 2}" maxlength="${limit}" data-notes-field="${key}" data-notes-row="${esc(row.id)}">${esc(row.after[key])}</textarea>`}</label>`).join("");
  return `<article class="card notes-piece ${row.selected ? "is-selected" : ""}" data-notes-piece="${esc(row.id)}"><div class="notes-row-heading"><label class="notes-checkbox"><input type="checkbox" data-notes-selected="${esc(row.id)}" ${row.selected ? "checked" : ""} /><span>${index + 1}. ${esc(NOTES_LABELS[row.collection] || "Draft piece")}</span></label><div class="notes-actions"><button type="button" class="prep-icon-button" data-notes-move="${esc(row.id)}" data-direction="-1" aria-label="Move piece up" ${index === 0 ? "disabled" : ""}>↑</button><button type="button" class="prep-icon-button" data-notes-move="${esc(row.id)}" data-direction="1" aria-label="Move piece down" ${index === book.draft.rows.length - 1 ? "disabled" : ""}>↓</button><button type="button" class="prep-icon-button" data-notes-remove-row="${esc(row.id)}" aria-label="Remove draft piece">×</button></div></div>${fields}${row.collection === "scenes" ? `<div class="notes-field-pair"><label>Scene kind<select data-notes-field="kind" data-notes-row="${esc(row.id)}">${["scene", "social", "exploration", "combat", "pressure"].map(kind => `<option${kind === row.after.kind ? " selected" : ""}>${kind}</option>`).join("")}</select></label><label>Minutes<input type="number" min="0" max="1440" data-notes-field="minutes" data-notes-row="${esc(row.id)}" value="${esc(row.after.minutes)}" /></label></div>` : row.collection === "clocks" ? `<label>Segments<input type="number" min="1" max="20" data-notes-field="max" data-notes-row="${esc(row.id)}" value="${esc(row.after.max)}" /></label>` : ""}${prepNotesEvidenceMarkup(row, book)}</article>`;
}
function prepNotesToolbar(context) {
  const { campaign, session, prep, book } = context, status = prepNotesCore().validateDraft(campaign, session);
  const selected = (book.draft?.rows || []).filter(row => row.selected);
  const minutes = selected.filter(row => row.collection === "scenes").reduce((sum, row) => sum + (Number(row.after.minutes) || 0), 0);
  const currentMinutes = sessionPrepCore().readiness(prep).plannedMinutes;
  return `<div><strong>${selected.length} ${selected.length === 1 ? "piece" : "pieces"} selected · ${minutes} new scene minutes</strong><p>${currentMinutes + minutes} / ${prep.durationMinutes} minutes planned after adding${currentMinutes + minutes > prep.durationMinutes ? " · over the session budget" : ""}.</p>${!status.valid ? `<p data-notes-validation>${esc(status.error)}</p>` : `<p>Selected pieces append to your saved prep. Your live desk retains its current copy.</p>`}</div><button type="button" class="primary-button" data-notes-apply ${status.valid ? "" : "disabled"}>Add selected to session prep</button>`;
}
function prepNotesView(campaign) {
  if (prepNotesBlocked()) return playerPreviewRestrictedView();
  let context;
  try { context = prepNotesContext(); } catch (error) { return `<section class="empty-state"><h2>Notes workspace unavailable</h2><p>${esc(error.message)}</p><button class="secondary-button" data-view-jump="sessions">Sessions</button></section>`; }
  const { session, prep, book } = context, busy = Boolean(prepNotesRequest);
  return `<div class="session-prep-page notes-page" data-notes-page="${esc(book.id)}">${header("Build from notes", `PREPARE · ${esc(session.title)}`, "Choose the campaign material that matters, shape playable situations, then add the pieces you want to run.", `<div class="notes-actions"><span class="save-hint" data-save-status>Saved</span><button class="secondary-button" type="button" data-notes-back>Back to session prep</button></div>`)}<div class="notes-steps"><span>1 · Choose notes</span><span>2 · Shape the session</span><span>3 · Review & add to prep</span></div><div data-notes-alert role="status">${prepNotesError ? `<p class="notes-warning">${esc(prepNotesError)}</p>` : ""}</div>
    ${book.draft ? `<div class="notes-toolbar" data-notes-toolbar>${prepNotesToolbar(context)}</div>` : ""}
    <div class="notes-layout"><section class="card notes-panel"><p class="eyebrow">CAMPAIGN MATERIAL</p><h2>Choose your source notes</h2><p class="prep-help">Search campaign records and imported PDF page text. Keep a focused excerpt from each record, or paste your own notes. These saved excerpts stay beside the draft.</p><fieldset ${busy ? "disabled" : ""}><label>Find campaign material<input type="search" data-notes-search value="${esc(prepNotesSearch)}" placeholder="A person, place, unresolved promise…" /></label><label>Record or PDF page<select data-notes-record>${prepNotesOptions(campaign)}</select></label><div class="notes-actions"><button class="secondary-button" type="button" data-notes-add-source>Add selected source</button><button class="secondary-button" type="button" data-notes-paste>Paste notes</button></div><div class="notes-sources">${book.sources.map(source => prepNotesSourceMarkup(campaign, source)).join("") || `<p class="prep-empty">Choose the notes that should shape this session.</p>`}</div></fieldset></section>
    <section class="notes-drafting"><div class="card notes-panel"><p class="eyebrow">THE NEXT PLAYABLE SESSION</p><h2>What should these notes put into play?</h2><label>Session brief<textarea rows="3" maxlength="2000" data-notes-brief ${busy ? "disabled" : ""} placeholder="The party follows the missing courier. Put their alliance with the watch under pressure, and leave room for negotiation or a chase.">${esc(book.brief)}</textarea></label><p class="prep-help">${prep.durationMinutes} minutes available; ${sessionPrepCore().readiness(prep).plannedMinutes} already planned. Describe the focus, tone, player interests, and constraints that matter.</p>${!book.draft ? `<div class="notes-actions"><button class="secondary-button" type="button" data-notes-manual ${busy ? "disabled" : ""}>Shape a draft myself</button></div><details class="notes-ai"><summary>Draft with my AI connection</summary><p class="prep-help">The request contains your campaign and session titles, game system, time budget, brief, and the selected excerpts shown here. Review the returned pieces and their exact source quotes before adding them.</p><form data-notes-ai-form><fieldset ${busy ? "disabled" : ""}>${aiConnectionFields(getCopilotState(), "Send the selected notes and session brief to this endpoint when you choose Draft playable session.")}<label class="notes-checkbox"><input type="checkbox" name="sendNotes" required /><span>I am ready to send these selected notes to this endpoint.</span></label><button type="submit" class="primary-button">Draft playable session</button></fieldset></form></details>` : `<div class="notes-actions"><button class="secondary-button" type="button" data-notes-rebase>Review changes & keep draft</button><button class="quiet-button" type="button" data-notes-clear-draft>Discard draft pieces</button></div><p class="prep-help">If notes or destination prep change, review them and confirm the review to retain your draft edits. Quotes must still match the chosen excerpts.</p>`}${busy ? `<p role="status">Drafting the session from your selected notes…</p><button class="secondary-button" type="button" data-notes-cancel>Cancel request</button>` : ""}</div>
      ${book.draft ? `<div class="notes-pieces">${book.draft.rows.map((row, index) => prepNotesRowMarkup(row, book, index)).join("")}</div><section class="card notes-panel"><h3>Add another piece</h3><div class="notes-actions">${Object.entries(NOTES_LABELS).map(([key, label]) => `<button type="button" class="secondary-button" data-notes-add-row="${key}">＋ ${label}</button>`).join("")}</div><label class="notes-checkbox"><input type="checkbox" data-notes-pin ${book.draft.pinSources ? "checked" : ""} /><span>Pin campaign records and PDF pages cited by the selected pieces</span></label></section>` : `<div class="notes-empty"><h3>From facts to table decisions</h3><p>A useful scene gives someone a want, puts something under pressure, and gives the players a meaningful choice.</p><p>Keep discoveries flexible: a clue can emerge through conversation, exploration, or consequences.</p></div>`}</section></div></div>`;
}
function prepNotesUpdateFeedback() {
  const page = document.querySelector("[data-notes-page]");
  if (!page) return;
  page.querySelector("[data-notes-alert]").innerHTML = prepNotesError ? `<p class="notes-warning">${esc(prepNotesError)}</p>` : "";
  const toolbar = page.querySelector("[data-notes-toolbar]");
  if (toolbar) {
    const updated = document.createElement("div");
    updated.innerHTML = prepNotesToolbar(prepNotesContext());
    // A field's blur/change event can fire between pressing and releasing Apply.
    // Keep that button attached so the click and keyboard focus remain valid.
    toolbar.firstElementChild.innerHTML = updated.firstElementChild.innerHTML;
    toolbar.querySelector("[data-notes-apply]").disabled = updated.querySelector("[data-notes-apply]").disabled;
  }
}
function prepNotesEdit(field) {
  const { book } = prepNotesContext();
  const row = book.draft?.rows.find(row => row.id === (field.dataset.notesRow || field.dataset.notesAdditions || field.dataset.notesSelected));
  if (field.matches("[data-notes-brief]")) book.brief = field.value;
  else if (field.matches("[data-notes-source-text]")) { const source = book.sources.find(source => source.id === field.dataset.notesSourceText); if (!source) return; source.text = field.value; }
  else if (field.matches("[data-notes-pin]")) book.draft.pinSources = field.checked;
  else if (!row) return;
  else if (field.matches("[data-notes-selected]")) { row.selected = field.checked; field.closest("[data-notes-piece]").classList.toggle("is-selected", row.selected); }
  else if (field.matches("[data-notes-field]")) {
    const key = field.dataset.notesField;
    if (!Object.hasOwn(prepNotesCore().FIELDS[row.collection], key) && !["kind", "minutes", "max"].includes(key)) return;
    row.after[key] = field.value;
  } else if (field.matches("[data-notes-additions]")) row.additions = field.value;
  else if (field.matches("[data-notes-evidence-quote]")) row.evidence[Number(field.dataset.notesEvidenceQuote)].quote = field.value;
  else if (field.matches("[data-notes-evidence-source]")) row.evidence[Number(field.dataset.notesEvidenceSource)].sourceId = field.value;
  else return;
  prepNotesError = ""; saveState(); prepNotesUpdateFeedback();
}
const prepNotesRoot = document.querySelector("#viewRoot");
prepNotesRoot.addEventListener("input", event => {
  if (prepNotesBlocked() || prepNotesRequest || !event.target.closest("[data-notes-page]")) return;
  try {
    if (event.target.matches("[data-notes-search]")) { prepNotesSearch = event.target.value; document.querySelector("[data-notes-record]").innerHTML = prepNotesOptions(activeCampaign()); }
    else prepNotesEdit(event.target);
  } catch (error) { prepNotesError = error.message; prepNotesUpdateFeedback(); }
});
prepNotesRoot.addEventListener("change", event => {
  if (prepNotesBlocked() || prepNotesRequest || !event.target.closest("[data-notes-page]")) return;
  try { prepNotesEdit(event.target); } catch (error) { prepNotesError = error.message; prepNotesUpdateFeedback(); }
});
prepNotesRoot.addEventListener("click", event => {
  const open = event.target.closest("[data-open-prep-notes]");
  if (open) { event.stopImmediatePropagation(); if (!prepNotesBlocked()) openPrepNotes(activeCampaign(), sessionFromAction(activeCampaign(), open.dataset.openPrepNotes)); return; }
  const button = event.target.closest("button"), page = event.target.closest("[data-notes-page]");
  if (!button || !page || prepNotesBlocked()) return;
  const action = ["back", "add-source", "paste", "remove-source", "refresh-source", "manual", "add-row", "remove-row", "move", "add-quote", "remove-quote", "rebase", "apply", "clear-draft", "cancel"].find(key => button.hasAttribute(`data-notes-${key}`));
  if (!action) return;
  event.preventDefault(); event.stopImmediatePropagation();
  try {
    const { campaign, session, book } = prepNotesContext();
    if (action === "back" || action === "cancel") { prepNotesRequest?.controller.abort(); prepNotesRequest = null; if (action === "back") openSessionPrep(campaign, session); else render(); return; }
    if (prepNotesRequest) return;
    prepNotesError = "";
    if (action === "add-source") { const value = page.querySelector("[data-notes-record]").value; if (!value) throw new Error("Choose a campaign record first."); prepNotesCore().addSource(campaign, session, JSON.parse(decodeURIComponent(value))); }
    else if (action === "paste") prepNotesCore().addSource(campaign, session);
    else if (action === "remove-source") book.sources = book.sources.filter(source => source.id !== button.dataset.notesRemoveSource);
    else if (action === "refresh-source") {
      const source = book.sources.find(source => source.id === button.dataset.notesRefreshSource);
      if (!source || !confirm("Replace this selected excerpt with the record's current text? Draft pieces keep their existing wording for review.")) return;
      prepNotesCore().refreshSource(campaign, source);
    } else if (action === "manual") { book.draft = prepNotesCore().createDraft(campaign, session); book.draft.rows.push(prepNotesCore().newRow("scenes", book.sources[0])); }
    else if (action === "add-row") { if (book.draft.rows.length >= 30) throw new Error("Use up to thirty draft pieces at a time."); book.draft.rows.push(prepNotesCore().newRow(button.dataset.notesAddRow, book.sources[0])); }
    else if (action === "remove-row") book.draft.rows = book.draft.rows.filter(row => row.id !== button.dataset.notesRemoveRow);
    else if (action === "move") { const index = book.draft.rows.findIndex(row => row.id === button.dataset.notesMove), next = index + Number(button.dataset.direction); if (index >= 0 && next >= 0 && next < book.draft.rows.length) [book.draft.rows[index], book.draft.rows[next]] = [book.draft.rows[next], book.draft.rows[index]]; }
    else if (action === "add-quote") { const row = book.draft.rows.find(row => row.id === button.dataset.notesAddQuote); if (row && row.evidence.length < 12 && book.sources[0]) row.evidence.push({ sourceId: book.sources[0].id, quote: "" }); }
    else if (action === "remove-quote") { const row = book.draft.rows.find(row => row.id === button.dataset.notesRow); if (row) row.evidence.splice(Number(button.dataset.notesRemoveQuote), 1); }
    else if (action === "clear-draft") { if (!confirm("Discard these draft pieces? Your selected sources and approved session prep stay saved.")) return; book.draft = null; }
    else if (action === "rebase") { if (!confirm("Keep these draft edits and review them against the current selected notes and saved session prep? Check the quotes and proposed additions before applying.")) return; prepNotesCore().rebaseDraft(campaign, session); }
    else if (action === "apply") { const result = prepNotesCore().applyDraft(campaign, session); saveState(); openSessionPrep(campaign, session); showToast(`${result.count} reviewed pieces added to session prep.`); return; }
    saveState(); render();
  } catch (error) { prepNotesError = error.message; prepNotesUpdateFeedback(); }
}, true);
prepNotesRoot.addEventListener("submit", async event => {
  if (!event.target.matches("[data-notes-ai-form]")) return;
  event.preventDefault(); event.stopImmediatePropagation();
  if (prepNotesBlocked() || prepNotesRequest) return;
  let request, timer;
  try {
    const { campaign, session, book } = prepNotesContext(), data = new FormData(event.target);
    const endpoint = String(data.get("endpoint") || "").trim(), model = String(data.get("model") || "").trim(), key = String(data.get("apiKey") || "").trim();
    if (!data.get("sendNotes") || !endpoint || !model || !(key || copilotToken)) throw new Error("Choose the endpoint, model, API key, and sending confirmation first.");
    if (book.draft) throw new Error("Review or discard the existing draft before requesting another.");
    const baseline = prepNotesCore().createDraft(campaign, session), messages = prepNotesCore().requestMessages(campaign, session);
    setCopilotToken(key || copilotToken);
    Object.assign(getCopilotState(), { endpoint, model });
    request = { controller: new AbortController(), campaign, session, book };
    prepNotesRequest = request; prepNotesError = ""; saveState(); render();
    timer = setTimeout(() => request.controller.abort(), 120000);
    const output = await callCampaignAI(endpoint, model, messages, { signal: request.controller.signal });
    if (prepNotesRequest !== request || prepNotesBlocked() || currentView !== "prep-notes" || activeCampaign() !== campaign || prepNotesContext().book !== book) return;
    prepNotesCore().acceptGeneratedDraft(campaign, session, parseAIJson(output), baseline);
    saveState();
  } catch (error) { if (!request || prepNotesRequest === request) prepNotesError = error.name === "AbortError" ? "The request was cancelled or reached its two-minute limit. Your notes remain saved; you can retry or shape the draft yourself." : `Draft not added: ${error.message}`; }
  finally { clearTimeout(timer); if (prepNotesRequest === request) prepNotesRequest = null; if (!prepNotesBlocked() && currentView === "prep-notes") render(); }
}, true);
