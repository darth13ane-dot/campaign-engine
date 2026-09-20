const test = require("node:test");
const assert = require("node:assert/strict");
const notes = require("../prep-notes.js");
const prep = require("../session-prep.js");
const workflow = require("../session-workflow.js");
const preview = require("../player-preview.js");
const schema = require("../workspace-schema.js");

function fixture(system = "WFRP 4e") {
  const campaign = { id: "campaign", title: "The river road", system, sessions: [{ localId: "session", title: "The missing courier", recap: "Mara owes the party a favor. The courier vanished at the old bridge.", number: 3 }], characters: [{ archivistId: "mara", name: "Mara", role: "NPC", description: "Mara wants her brother returned safely." }], journal: [{ localId: "secret", title: "Unselected secret", body: "UNSELECTED_CAMPAIGN_SECRET" }], quests: [], locations: [], arcs: [], connections: [] };
  workflow.ensureWorkflow(campaign);
  const session = campaign.sessions[0], plan = prep.ensurePrep(campaign, session);
  const book = notes.ensureWorkbench(campaign, session);
  const source = notes.addSource(campaign, session, { type: "session", localId: session.localId, name: session.title });
  return { campaign, session, plan, book, source };
}
function scene(source) { return { collection: "scenes", after: { title: "At the bridge", detail: "Mara offers information in exchange for searching the bridge. A watch patrol arrives; the party can bargain, investigate, or leave.", question: "Will they accept Mara's terms or seek another lead?", kind: "social", minutes: 35 }, evidence: [{ sourceId: source.id, quote: "Mara owes the party a favor." }], additions: "Proposed watch patrol and Mara's offer." }; }
function generated(f, rows = [scene(f.source)]) {
  return notes.acceptGeneratedDraft(f.campaign, f.session, { rows }, notes.createDraft(f.campaign, f.session));
}
function selectAll(f) { f.book.draft.rows.forEach(row => { row.selected = true; }); }

test("source-scoped request includes only selected excerpts and an honest remaining time budget", () => {
  const f = fixture();
  f.plan.scenes.push({ id: "existing", title: "Arrival", detail: "A queue", question: "Wait?", minutes: 45 });
  f.book.brief = "Follow the courier lead and test the alliance.";
  const messages = notes.requestMessages(f.campaign, f.session), content = JSON.stringify(messages);
  assert.equal(messages[0].role, "system");
  assert.equal(messages[1].role, "user");
  assert.ok(content.includes(f.source.text));
  assert.ok(!content.includes("UNSELECTED_CAMPAIGN_SECRET"));
  assert.ok(!content.includes("Mara wants her brother"));
  assert.equal(JSON.parse(messages[1].content).remainingSceneMinutes, 135);
});

test("generated draft saves for review with no selected rows and no campaign mutation", () => {
  const f = fixture(), canon = structuredClone(f.campaign.sessions);
  const draft = generated(f);
  assert.equal(draft.rows[0].selected, false);
  assert.equal(f.plan.scenes.length, 0);
  assert.deepEqual(f.campaign.sessions, canon);
  assert.equal(notes.validateDraft(f.campaign, f.session).valid, false);
  assert.throws(() => notes.applyDraft(f.campaign, f.session), /Select the finished/);
});

test("selected pieces append once, retain multiple citations and additions, and preserve canon and live play", () => {
  const f = fixture(), second = notes.addSource(f.campaign, f.session, { type: "character", archivistId: "mara", name: "Mara" });
  f.plan.opening = "Existing opening.";
  const desk = workflow.startDesk(f.campaign, f.session);
  desk.scratch = "A live note";
  const beforeDesk = structuredClone(desk), beforeRecords = structuredClone(f.campaign.sessions);
  const row = scene(f.source);
  row.evidence.push({ sourceId: second.id, quote: "Mara wants her brother returned safely." });
  generated(f, [{ ...row, collection: "opening", after: { opening: "Mara waits at the bridge with an urgent offer." } }, row, { ...row, collection: "tasks", after: { text: "Prepare a bridge sketch." } }]);
  f.book.draft.rows[0].selected = true; f.book.draft.rows[1].selected = true;
  const result = notes.applyDraft(f.campaign, f.session);
  assert.equal(result.count, 2);
  assert.equal(f.plan.opening, "Existing opening.\n\nMara waits at the bridge with an urgent offer.");
  assert.equal(f.plan.scenes.length, 1);
  assert.equal(f.plan.scenes[0].provenance.sourceNotes.length, 2);
  assert.equal(f.plan.scenes[0].provenance.additions, row.additions);
  assert.equal(f.plan.pinned.length, 2);
  assert.equal(f.plan.notesWorkbench.draft.rows.length, 1);
  assert.throws(() => notes.applyDraft(f.campaign, f.session), /Select the finished/);
  assert.deepEqual(desk, beforeDesk);
  assert.deepEqual(f.campaign.sessions, beforeRecords);
  f.plan.notesWorkbench.draft.rows[0].selected = true;
  notes.applyDraft(f.campaign, f.session);
  assert.equal(f.plan.tasks.length, 1);
  assert.equal(f.plan.tasks[0].done, false);
  assert.equal(f.plan.notesWorkbench.draft, null);
});

test("manual preparation works across systems with no AI and preserves row order", () => {
  for (const system of ["WFRP 4e", "Pathfinder 2e", "Blades in the Dark", "Custom"]) {
    const f = fixture(system);
    f.book.draft = notes.createDraft(f.campaign, f.session);
    for (const title of ["Ask Mara", "Follow the river"]) {
      const row = notes.newRow("scenes", f.source);
      Object.assign(row.after, scene(f.source).after, { title });
      f.book.draft.rows.push(row);
    }
    notes.applyDraft(f.campaign, f.session);
    assert.deepEqual(f.plan.scenes.map(row => row.title), ["Ask Mara", "Follow the river"]);
  }
});

test("invalid generated citations and oversized results reject the entire response", () => {
  const f = fixture(), baseline = notes.createDraft(f.campaign, f.session);
  const wrong = scene(f.source); wrong.evidence[0].quote = "A made-up fact";
  assert.throws(() => notes.acceptGeneratedDraft(f.campaign, f.session, { rows: [scene(f.source), wrong] }, baseline), /does not match/);
  assert.equal(f.book.draft, null);
  wrong.evidence[0] = { sourceId: "forged", quote: "Mara" };
  assert.throws(() => notes.acceptGeneratedDraft(f.campaign, f.session, { rows: [wrong] }, baseline), /does not match/);
  wrong.evidence = [];
  assert.throws(() => notes.acceptGeneratedDraft(f.campaign, f.session, { rows: [wrong] }, baseline), /source quote/);
  const long = scene(f.source); long.after.detail = "x".repeat(6001);
  assert.throws(() => notes.acceptGeneratedDraft(f.campaign, f.session, { rows: [long] }, baseline), /longer than/);
  assert.throws(() => notes.acceptGeneratedDraft(f.campaign, f.session, { rows: Array(31).fill(scene(f.source)) }, baseline), /one to thirty/);
  assert.equal(f.plan.scenes.length, 0);
});

test("changed source, missing identities and same-name replacements cannot silently apply", () => {
  const f = fixture(); generated(f); selectAll(f);
  f.session.recap += " The bridge is now closed.";
  assert.equal(notes.validateDraft(f.campaign, f.session).valid, false);
  const savedQuote = f.book.draft.rows[0].evidence[0].quote;
  notes.refreshSource(f.campaign, f.source);
  notes.rebaseDraft(f.campaign, f.session);
  assert.equal(f.book.draft.rows[0].evidence[0].quote, savedQuote);
  assert.equal(notes.validateDraft(f.campaign, f.session).valid, true);
  const second = notes.addSource(f.campaign, f.session, { type: "character", archivistId: "mara", name: "Mara" });
  f.campaign.characters[0] = { archivistId: "replacement", name: "Mara", description: "Same name, new identity" };
  assert.equal(notes.sourceStatus(f.campaign, second).valid, false);
  assert.throws(() => notes.rebaseDraft(f.campaign, f.session), /missing or ambiguous/);
});

test("source excerpts are exact record passages; new writing belongs in pasted notes", () => {
  const f = fixture();
  f.source.text = "The duke murdered the courier.";
  assert.throws(() => notes.createDraft(f.campaign, f.session), /exact passage/);
  f.source.text = "The courier vanished at the old bridge.";
  const pasted = notes.addSource(f.campaign, f.session);
  pasted.text = "GM idea: the watch wants to suppress the investigation.";
  assert.ok(notes.createDraft(f.campaign, f.session));
});

test("changed destination, live status, brief or selected excerpts invalidate a saved review", () => {
  for (const mutate of [f => { f.plan.opening = "My local edit"; }, f => workflow.startDesk(f.campaign, f.session), f => { f.book.brief = "A different focus"; }, f => { f.source.text = "Mara owes the party a favor."; }]) {
    const f = fixture(); generated(f); selectAll(f); mutate(f);
    assert.equal(notes.validateDraft(f.campaign, f.session).valid, false);
    assert.throws(() => notes.applyDraft(f.campaign, f.session), /changed/);
    notes.rebaseDraft(f.campaign, f.session);
    assert.equal(notes.validateDraft(f.campaign, f.session).valid, true);
  }
});

test("late responses cannot replace local drafts or changed input", () => {
  const f = fixture(), baseline = notes.createDraft(f.campaign, f.session);
  f.book.brief = "Now do a different session";
  assert.throws(() => notes.acceptGeneratedDraft(f.campaign, f.session, { rows: [scene(f.source)] }, baseline), /changed/);
  f.book.brief = ""; f.book.draft = notes.createDraft(f.campaign, f.session);
  assert.throws(() => notes.acceptGeneratedDraft(f.campaign, f.session, { rows: [scene(f.source)] }, baseline), /changed/);
});

test("review fields and provenance survive normalization, workspace roundtrip, export and first play", () => {
  const f = fixture(); generated(f); selectAll(f);
  const restored = schema.normalizeWorkspace(JSON.parse(JSON.stringify({ state: { campaigns: [f.campaign] } })));
  const campaign = restored.state.campaigns[0]; campaign.sessionWorkflow = workflow.normalizeWorkflow(campaign.sessionWorkflow);
  const session = campaign.sessions[0], plan = prep.findPrepForSession(campaign, session);
  assert.deepEqual(plan.notesWorkbench, f.book);
  notes.applyDraft(campaign, session);
  const openingSource = structuredClone(plan.scenes[0].provenance);
  plan.opening = "An urgent appeal."; plan.openingProvenance = [openingSource];
  const normalized = prep.normalizePrep(plan);
  assert.deepEqual(normalized.openingProvenance, [openingSource]);
  assert.deepEqual(normalized.scenes[0].provenance, openingSource);
  const md = prep.exportMarkdown(campaign, session, plan);
  assert.ok(md.includes("Mara owes the party a favor"));
  assert.ok(md.includes("Proposed watch patrol"));
  const desk = workflow.startDesk(campaign, session);
  assert.deepEqual(desk.beats[0].provenance, openingSource);
  assert.deepEqual(desk.openingProvenance, [openingSource]);
  assert.ok(!JSON.stringify(preview.projectCampaign(campaign)).includes("notesWorkbench"));
  assert.ok(!JSON.stringify(preview.projectCampaign(campaign)).includes("Proposed watch patrol"));
});

test("unsupported notes formats remain saved and cannot be overwritten by opening the editor", () => {
  const f = fixture(); f.book.schemaVersion = 999; f.book.future = "valuable future material";
  const before = JSON.stringify(f.plan.notesWorkbench);
  assert.throws(() => notes.ensureWorkbench(f.campaign, f.session), /unsupported format/);
  assert.equal(JSON.stringify(f.plan.notesWorkbench), before);
  assert.equal(prep.normalizePrep(f.plan).notesWorkbench.future, "valuable future material");
});

test("invalid selected pieces fail atomically and oversized appended openings cannot be truncated", () => {
  const f = fixture(); generated(f); selectAll(f);
  f.book.draft.rows.push({ ...structuredClone(f.book.draft.rows[0]), id: "other", after: { title: "Missing detail" } });
  assert.throws(() => notes.applyDraft(f.campaign, f.session), /title, situation/);
  assert.equal(f.plan.scenes.length, 0);
  f.book.draft = null; f.plan.opening = "x".repeat(11999);
  generated(f, [{ ...scene(f.source), collection: "opening", after: { opening: "An urgent appeal." } }]); selectAll(f);
  assert.throws(() => notes.applyDraft(f.campaign, f.session), /12000/);
  assert.equal(f.plan.opening.length, 11999);
});

test("duplicate record names resolve through stable identities and ambiguity fails closed", () => {
  const f = fixture();
  f.campaign.characters.push({ archivistId: "other-mara", name: "Mara", description: "A different person." });
  const source = notes.addSource(f.campaign, f.session, { type: "character", archivistId: "other-mara", name: "Mara" });
  assert.ok(source.text.includes("A different person."));
  assert.throws(() => notes.addSource(f.campaign, f.session, { type: "character", name: "Mara" }), /ambiguous/);
  f.campaign.characters.push({ ...f.campaign.characters[1] });
  assert.equal(notes.sourceStatus(f.campaign, source).valid, false);
});
