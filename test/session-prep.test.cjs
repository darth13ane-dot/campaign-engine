const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const prep = require("../session-prep.js");
const workflow = require("../session-workflow.js");
const merge = require("../archivist-merge.js");
const persistence = require("../workspace-persistence.js");

function campaign() {
  return {
    id: "campaign-1", title: "The Ash March", source: "manual",
    sessions: [{ localId: "session-1", title: "The Crossing", number: 4, date: "2026-09-20", upcoming: true, recap: "Reach the flooded river.", directions: ["Bargain with the ferryman"] }],
    characters: [{ localId: "char-1", name: "Vale", role: "NPC", description: "A nervous guard", voice: "Whispers", statBlock: "Wounds 10" }, { localId: "char-2", name: "Private villain", description: "Unpinned secret record" }],
    quests: [], locations: [], journal: [], arcs: [], connections: []
  };
}

function filledPrep(value) {
  workflow.ensureWorkflow(value);
  const plan = prep.ensurePrep(value, value.sessions[0]);
  Object.assign(plan, {
    opening: "The bell rings beneath the river.", durationMinutes: 120,
    scenes: [{ id: "scene-1", title: "At the gate", kind: "social", minutes: 45, detail: "Vale demands a favor.", question: "Trade the relic or take the flooded path?" }],
    pinned: [{ type: "character", name: "Vale", localId: "char-1" }],
    revelations: [{ id: "clue-1", text: "The ferry carries stolen relics.", checked: false }],
    clocks: [{ id: "clock-1", label: "Flood", max: 6, value: 1 }],
    spotlights: [{ id: "spotlight-1", character: "Mira", opportunity: "Recognize the lost seal." }],
    tasks: [{ id: "task-1", text: "Prepare the gate map", done: true }]
  });
  return plan;
}

test("preparation creates private workflow state without starting play or changing session content", () => {
  const value = campaign(), before = structuredClone(value);
  workflow.ensureWorkflow(value);
  const plan = prep.ensurePrep(value, value.sessions[0]);
  assert.equal(plan.durationMinutes, 180);
  assert.equal(plan.sessionRef.localId, "session-1");
  assert.deepEqual(value.sessionWorkflow.desks, {});
  assert.deepEqual(value.sessions, before.sessions);
  assert.deepEqual(value.characters, before.characters);
  assert.equal(prep.ensurePrep(value, value.sessions[0]), plan);
  assert.equal(Object.keys(value.sessionWorkflow.preps).length, 1);
  assert.throws(() => prep.ensurePrep(value, { localId: "missing", title: "Removed" }), /no longer/);
});

test("preparation survives serialization, workflow normalization, and browser restoration with blank draft rows", () => {
  const value = campaign(), plan = filledPrep(value);
  plan.scenes.push({ id: "blank-scene", title: "", kind: "combat", minutes: 30, detail: "", question: "" });
  plan.tasks.push({ id: "blank-task", text: "", done: false });
  plan.revelations.push({ id: "blank-clue", text: "", checked: false });
  plan.spotlights.push({ id: "blank-spotlight", character: "", opportunity: "" });
  const saved = JSON.parse(JSON.stringify({ campaigns: [value], activeCampaignId: value.id }));
  const restored = persistence.initialState(saved, [], {}).campaigns[0];
  restored.sessionWorkflow = workflow.normalizeWorkflow(restored.sessionWorkflow);
  assert.deepEqual(prep.findPrepForSession(restored, restored.sessions[0]), plan);
  assert.deepEqual(restored.sessionWorkflow.desks, {});
});

test("references retain renamed local and Archivist sessions and keep duplicate titles separate", () => {
  const value = campaign();
  value.sessions.push({ ...value.sessions[0], localId: "session-2" }, { ...value.sessions[0], localId: undefined, archivistId: "source-session" });
  workflow.ensureWorkflow(value);
  const plans = value.sessions.map(session => prep.ensurePrep(value, session));
  assert.equal(new Set(plans.map(plan => plan.id)).size, 3);
  value.sessions.forEach((session, index) => session.title = `New title ${index}`);
  value.sessions.forEach((session, index) => {
    assert.equal(prep.findPrepForSession(value, session), plans[index]);
    assert.equal(prep.findSession(value, plans[index].sessionRef), session);
  });
  assert.equal(prep.findSession(value, { localId: "deleted", name: "New title 0" }), null);
});

test("unique legacy references upgrade before rename while ambiguous names remain unattached", () => {
  const value = campaign();
  value.sessionWorkflow = workflow.normalizeWorkflow({ schemaVersion: 1, preps: { old: { id: "old", sessionRef: { name: "The Crossing", number: 4 }, opening: "Old preparation" } }, desks: { desk: { id: "desk", sessionRef: { name: "The Crossing", number: 4 }, scratch: "Old live notes" } } });
  prep.ensureSessionReferences(value, value.sessions[0]);
  value.sessions[0].title = "Beyond the River";
  assert.equal(prep.findPrepForSession(value, value.sessions[0]).opening, "Old preparation");
  assert.equal(workflow.findDeskForSession(value, value.sessions[0]).scratch, "Old live notes");
  assert.equal(value.sessionWorkflow.preps.old.sessionRef.localId, "session-1");

  const duplicate = campaign();
  duplicate.sessions.push({ ...duplicate.sessions[0], localId: "session-2" });
  duplicate.sessionWorkflow = workflow.normalizeWorkflow({ preps: { old: { id: "old", sessionRef: { name: "The Crossing", number: 4 }, opening: "Unassigned old notes" } } });
  assert.equal(prep.findPrepForSession(duplicate, duplicate.sessions[0]), null);
  const newPlan = prep.ensurePrep(duplicate, duplicate.sessions[0]);
  assert.notEqual(newPlan.id, "old");
  assert.equal(duplicate.sessionWorkflow.preps.old.opening, "Unassigned old notes");
  assert.equal(duplicate.sessionWorkflow.preps.old.sessionRef.localId, undefined);
});

test("first start copies the prepared packet once and subsequent starts preserve live edits", () => {
  const value = campaign(), plan = filledPrep(value);
  const before = structuredClone(plan);
  const desk = workflow.startDesk(value, value.sessions[0], "2026-09-20T18:00:00.000Z");
  assert.equal(desk.opening, plan.opening);
  assert.equal(desk.beats[0].kind, "social");
  assert.equal(desk.beats[0].detail, plan.scenes[0].detail);
  assert.equal(desk.beats[0].question, plan.scenes[0].question);
  assert.equal(desk.beats[0].minutes, 45);
  assert.deepEqual(desk.pinned, plan.pinned);
  assert.deepEqual(desk.spotlights, plan.spotlights);
  assert.deepEqual(desk.revelations, plan.revelations);
  assert.deepEqual(desk.clocks, plan.clocks);
  desk.beats[0].done = true;
  desk.beats[0].detail = "An improvised bargain";
  desk.revelations[0].checked = true;
  desk.clocks[0].value = 5;
  desk.scratch = "Live ruling";
  desk.log.push({ id: "log", at: "2026-09-20T18:10:00.000Z", text: "A deal is struck" });
  assert.deepEqual(plan, before);
  plan.opening = "Revised for a future run";
  plan.scenes.push({ id: "scene-later", title: "Later prep", kind: "scene", minutes: 30, detail: "", question: "" });
  const liveSnapshot = structuredClone(desk);
  const resumed = workflow.startDesk(value, value.sessions[0]);
  assert.deepEqual(resumed, liveSnapshot);
  value.sessionWorkflow = workflow.normalizeWorkflow(JSON.parse(JSON.stringify(value.sessionWorkflow)));
  assert.deepEqual(workflow.startDesk(value, value.sessions[0]), liveSnapshot);
  assert.equal(Object.keys(value.sessionWorkflow.desks).length, 1);
});

test("an opening-only prep preserves existing possible directions on its first live start", () => {
  const value = campaign();
  workflow.ensureWorkflow(value);
  prep.ensurePrep(value, value.sessions[0]).opening = "Storm clouds gather";
  const desk = workflow.startDesk(value, value.sessions[0]);
  assert.equal(desk.beats[0].title, "Bargain with the ferryman");
  assert.equal(desk.opening, "Storm clouds gather");
});

test("approved Archivist refresh preserves preparation and resolves renamed imported records", () => {
  const value = campaign();
  value.source = "archivist";
  delete value.sessions[0].localId;
  value.sessions[0].archivistId = "source-session";
  delete value.characters[0].localId;
  value.characters[0].archivistId = "source-character";
  const plan = filledPrep(value);
  plan.pinned[0] = { type: "character", name: "Vale", archivistId: "source-character" };
  const incoming = structuredClone(value);
  incoming.sessions[0].title = "The New Crossing";
  incoming.characters[0].name = "Captain Vale";
  incoming.sessionWorkflow = {};
  const review = merge.createReview([value], [incoming], {}, {});
  const result = merge.applyReview(review, [value]).campaigns[0];
  const restored = prep.findPrepForSession(result, result.sessions[0]);
  assert.deepEqual(restored, plan);
  assert.equal(prep.resolveRecord(result, restored.pinned[0]).name, "Captain Vale");
  assert.equal(result.sessions[0].title, "The New Crossing");
});

test("readiness reports actual preparation, timing overruns, unfinished tasks, and missing records without mutation", () => {
  const value = campaign(), plan = filledPrep(value);
  const before = JSON.stringify(value);
  const ready = prep.readiness(plan, value);
  assert.equal(ready.complete, ready.total);
  assert.equal(ready.plannedMinutes, 45);
  assert.equal(ready.durationMinutes, 120);
  assert.equal(JSON.stringify(value), before);
  plan.scenes[0].minutes = 150;
  plan.tasks[0].done = false;
  plan.pinned[0].localId = "removed-character";
  const checks = Object.fromEntries(prep.readiness(plan, value).checks.map(check => [check.id, check.done]));
  assert.equal(checks.timing, false);
  assert.equal(checks.tasks, false);
  assert.equal(checks.records, false);
  assert.equal(checks.opening, true);
  plan.tasks = [];
  assert.equal(prep.readiness(plan).checks.find(check => check.id === "tasks").done, true);
  plan.scenes.push({ id: "draft", title: "", detail: "", question: "", minutes: 30 });
  assert.equal(prep.readiness(plan).checks.find(check => check.id === "scenes").done, false);
  assert.equal(prep.readiness({}).checks.find(check => check.id === "scenes").done, false);
});

test("prep review identifies missing scene situations and choices even beside a complete scene with the same name", () => {
  const value = campaign(), plan = filledPrep(value);
  plan.scenes.push({ ...plan.scenes[0], id: "second", question: "" });
  let status = prep.readiness(plan, value);
  assert.equal(status.checks.find(check => check.id === "scenes").done, false);
  assert.match(status.nextSteps.find(step => step.id === "scene-1").label, /Scene 2/);
  assert.deepEqual(status.nextSteps.find(step => step.id === "scene-1").target, { type: "field", collection: "scenes", index: 1, field: "question" });
  plan.scenes[1].question = "Which route?"; plan.scenes[1].detail = "";
  status = prep.readiness(plan, value);
  assert.equal(status.nextSteps.find(step => step.id === "scene-1").target.field, "detail");
  plan.scenes[1].detail = "A locked gate.";
  assert.equal(prep.readiness(plan, value).nextSteps.length, 0);
});

test("prep review distinguishes missing pinned and scene PDF references by their exact page and location", () => {
  const value = campaign(), plan = filledPrep(value);
  value.documents = [{ id: "guide", title: "River guide", pageTexts: [{ page: 1, text: "The ferry waits." }] }];
  const ref = { type: "reference", id: "guide", name: "River guide", page: 1 };
  plan.pinned.push(ref);
  plan.scenes[0].references = [{ ...ref, page: 2 }];
  let steps = prep.readiness(plan, value).nextSteps;
  assert.equal(steps.filter(step => step.target.type === "scene-reference").length, 1);
  assert.equal(steps.filter(step => step.target.type === "pin").length, 0);
  value.documents[0].id = "replacement";
  steps = prep.readiness(plan, value).nextSteps;
  assert.deepEqual(steps.find(step => step.target.type === "pin").target, { type: "pin", index: 1 });
  assert.deepEqual(steps.find(step => step.target.type === "scene-reference").target, { type: "scene-reference", index: 0 });
});

test("prep review gives concrete targets for unfinished supporting work and clears them after edits", () => {
  const value = campaign(), plan = filledPrep(value);
  plan.scenes[0].minutes = 150; plan.tasks[0].done = false;
  plan.spotlights.push({ id: "partial", character: "Ada", opportunity: "" });
  plan.revelations.push({ id: "blank", text: "" }); plan.clocks[0].label = "";
  const steps = prep.readiness(plan, value).nextSteps;
  assert.match(steps.find(step => step.id === "budget").label, /30 minutes over/);
  assert.equal(steps.find(step => step.id === "task-0").target.field, "done");
  assert.equal(steps.find(step => step.id === "spotlight-1").target.field, "opportunity");
  assert.equal(steps.find(step => step.id === "revelations-1").target.field, "text");
  assert.equal(steps.find(step => step.id === "clocks-0").target.field, "label");
  assert.equal(prep.readiness(plan, value).checks.find(check => check.id === "spotlights").done, false);
  plan.scenes[0].minutes = 45; plan.tasks[0].done = true; plan.spotlights[1].opportunity = "Read the seal.";
  plan.revelations[1].text = "The seal is a copy."; plan.clocks[0].label = "Flood";
  assert.deepEqual(prep.readiness(plan, value).nextSteps, []);
});

test("prep review is derived without changing canon, live progress or pending draft approvals", () => {
  const value = campaign(), plan = filledPrep(value);
  const desk = workflow.startDesk(value, value.sessions[0]); desk.scratch = "Live observations";
  plan.notesWorkbench = { schemaVersion: 1, draft: { rows: [{ id: "draft", selected: false }] } };
  plan.tasks[0].done = false;
  const before = structuredClone(value);
  const review = prep.readiness(plan, value);
  assert.equal(review.nextSteps.find(step => step.id === "notes-draft").target.type, "notes");
  assert.deepEqual(value, before);
  const restored = workflow.normalizeWorkflow(JSON.parse(JSON.stringify(value.sessionWorkflow)));
  assert.deepEqual(prep.readiness(restored.preps[plan.id], value).nextSteps, review.nextSteps);
  plan.notesWorkbench.schemaVersion = 99;
  assert.equal(prep.readiness(plan, value).nextSteps.some(step => step.id === "notes-draft"), false);
});

test("private Markdown packet contains prepared material and resolved pins, omits unrelated records, and leaves canon untouched", () => {
  const value = campaign(), plan = filledPrep(value);
  value.characters[0].name = "Captain Vale";
  plan.scenes[0].detail = "<script>alert('untrusted')</script>\nSee [remote](https://example.test).";
  const before = JSON.stringify(value);
  const packet = prep.exportMarkdown(value, value.sessions[0], plan);
  assert.match(packet, /GM ONLY — PRIVATE PREPARATION/);
  assert.match(packet, /The bell rings beneath the river/);
  assert.match(packet, /Trade the relic or take the flooded path/);
  assert.match(packet, /45 minutes planned \/ 120 minutes available/);
  assert.match(packet, /Captain Vale/);
  assert.match(packet, /Wounds 10/);
  assert.match(packet, /Recognize the lost seal/);
  assert.match(packet, /\[x\] Prepare the gate map/);
  assert.match(packet, /&lt;script&gt;/);
  assert.doesNotMatch(packet, /<script>|Unpinned secret record|Private villain/);
  assert.equal(JSON.stringify(value), before);
  value.characters = value.characters.filter(record => record.localId !== "char-1");
  value.characters.push({ localId: "replacement", name: "Vale", description: "Different record with same name" });
  const missingPacket = prep.exportMarkdown(value, value.sessions[0], plan);
  assert.match(missingPacket, /linked record is unavailable/);
  assert.doesNotMatch(missingPacket, /Different record with same name/);
});

function attributedPrep() {
  const value = campaign(), plan = filledPrep(value);
  const source = { localId: "source-session", title: "Before the Crossing", number: 3, upcoming: false, recap: "The watch found an abandoned ferry." };
  value.sessions.push(source);
  const desk = workflow.startDesk(value, source);
  workflow.endDesk(value, desk.id);
  for (const collection of ["scenes", "revelations", "clocks", "spotlights", "tasks", "pinned"]) {
    const row = plan[collection][0];
    row.provenance = {
      key: `source:${collection}:${row.id || row.localId}`,
      sourceDeskId: desk.id, sourceSessionRef: prep.sessionReference(source),
      sourceCollection: collection === "scenes" ? "beats" : collection,
      sourceRowId: row.id || row.localId, label: source.title,
      ...(collection === "pinned" ? { recordRef: prep.recordReference(row) } : {})
    };
  }
  plan.continuityReview = { candidates: [{ label: "UNREVIEWED_MARKER", after: { title: "UNREVIEWED_MARKER" } }], source: { recap: "UNREVIEWED_MARKER" } };
  return { value, plan, source, desk };
}

test("carried provenance survives normalization and exports every applied row with the current source title", () => {
  const { value, plan, source, desk } = attributedPrep();
  source.title = "The Renamed Crossing";
  const before = JSON.stringify(value);
  const normalized = prep.normalizePrep(JSON.parse(JSON.stringify(plan)));
  for (const collection of ["scenes", "revelations", "clocks", "spotlights", "tasks", "pinned"]) {
    assert.deepEqual(normalized[collection][0].provenance, plan[collection][0].provenance);
    const attribution = prep.describeProvenance(value, normalized[collection][0].provenance);
    assert.equal(attribution.label, "The Renamed Crossing");
    assert.equal(attribution.session, source);
    assert.equal(attribution.desk, desk);
    assert.equal(attribution.missing, false);
  }
  assert.deepEqual(normalized.continuityReview, plan.continuityReview);
  assert.notEqual(normalized.continuityReview, plan.continuityReview);
  const packet = prep.exportMarkdown(value, value.sessions[0], normalized);
  assert.equal((packet.match(/From The Renamed Crossing/g) || []).length, 6);
  assert.doesNotMatch(packet, /Before the Crossing|UNREVIEWED_MARKER/);
  assert.equal(JSON.stringify(value), before);
});

test("deleted source sessions never attach to a same-name replacement and retain only a matching ended log", () => {
  const { value, plan, source, desk } = attributedPrep();
  const provenance = plan.scenes[0].provenance;
  value.sessions = value.sessions.filter(session => session !== source);
  const replacement = { localId: "replacement-session", title: source.title, number: 3, recap: "REPLACEMENT_SECRET" };
  value.sessions.push(replacement);
  let attribution = prep.describeProvenance(value, provenance);
  assert.equal(attribution.session, null);
  assert.equal(attribution.desk, desk);
  assert.equal(attribution.missing, true);
  assert.match(attribution.context, /source session record is no longer available/);
  desk.sessionRef = prep.sessionReference(replacement);
  attribution = prep.describeProvenance(value, provenance);
  assert.equal(attribution.desk, null, "A reused desk ID must not open another session's log");
  assert.match(attribution.context, /source session log is no longer available/);
  const packet = prep.exportMarkdown(value, value.sessions[0], plan);
  assert.match(packet, /source unavailable/);
  assert.doesNotMatch(packet, /REPLACEMENT_SECRET/);
});

test("campaign-record origins follow stable quest and arc IDs without same-name substitution", () => {
  const value = campaign(), plan = filledPrep(value);
  for (const [collection, type] of [["quests", "quest"], ["arcs", "arc"]]) {
    const record = { localId: `${type}-origin`, title: "Original thread", detail: "The current lead", tension: "The current pressure" };
    value[collection].push(record);
    const provenance = { key: `${type}:origin`, sourceCollection: collection, sourceRowId: record.localId, recordRef: prep.recordReference({ ...record, type }), label: "Current campaign" };
    record.title = "Renamed thread";
    let attribution = prep.describeProvenance(value, provenance);
    assert.equal(attribution.record, record);
    assert.match(attribution.label, /Renamed thread/);
    assert.equal(attribution.missing, false);
    plan.scenes[0].provenance = provenance;
    assert.match(prep.exportMarkdown(value, value.sessions[0], plan), /From (Quest|Story arc) · Renamed thread/);
    value[collection] = [{ localId: `${type}-replacement`, title: "Original thread", detail: "REPLACEMENT_RECORD_SECRET" }];
    attribution = prep.describeProvenance(value, provenance);
    assert.equal(attribution.record, null);
    assert.equal(attribution.missing, true);
    const packet = prep.exportMarkdown(value, value.sessions[0], plan);
    assert.match(packet, /source record is no longer available/);
    assert.doesNotMatch(packet, /REPLACEMENT_RECORD_SECRET/);
  }
});

function prepViewHarness(value) {
  const context = {
    window: { CampaignSessionPrep: prep, CampaignPrepContinuity: {} },
    document: { querySelector: () => ({ addEventListener() {} }) },
    SESSION_WORKFLOW: workflow, activeCampaign: () => value,
    playerPreviewActive: () => false, playerPreviewRestrictedView: () => "PLAYER_PREVIEW",
    esc: value => String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character])),
    ENTRY_TYPES: { character: "Character", quest: "Quest", arc: "Story arc" },
    sessionActionRef: session => encodeURIComponent(JSON.stringify(prep.sessionReference(session))),
    playerPacketAction: () => '<button data-open-player-packet="test-session">Player packets</button>',
    deskEntryAction: () => "data-open-entity", saveState() {}, render() {},
    header: (title, label, description, actions) => `<header>${actions}</header>`
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../session-prep-views.js"), "utf8"), context);
  context.openSessionPrep(value, value.sessions[0]);
  return context;
}

test("source disclosures and Markdown escape source text and omit pending review material", () => {
  const { value, plan, source } = attributedPrep();
  source.title = '<img src=x onerror="alert(1)"> [Portal](https://example.test)';
  source.recap = '<script>alert("source notes")</script>';
  const view = prepViewHarness(value);
  const markup = view.sessionPrepView(value);
  assert.equal((markup.match(/class="prep-provenance"/g) || []).length, 6);
  assert.match(markup, /From &lt;img/);
  assert.match(markup, /data-open-session-desk=/);
  assert.match(markup, /data-open-prep-continuity=/);
  assert.match(markup, /class="prep-row-group"[^>]*><div class="prep-task is-done"/);
  assert.match(markup, /class="prep-row-group"[^>]*><div class="prep-text-row"/);
  assert.doesNotMatch(markup, /<img|<script>|UNREVIEWED_MARKER/);
  const packet = prep.exportMarkdown(value, value.sessions[0], plan);
  assert.match(packet, /From &lt;img/);
  assert(packet.includes("\\[Portal\\]\\(https://example\\.test\\)"));
  assert.doesNotMatch(packet, /<img|<script>|UNREVIEWED_MARKER/);
  view.window.CampaignPrepContinuity = null;
  assert.doesNotMatch(view.sessionPrepView(value), /data-open-prep-continuity=/);
  view.playerPreviewActive = () => true;
  assert.equal(view.prepProvenanceMarkup(value, plan.scenes[0]), "");
  assert.equal(view.sessionPrepView(value), "PLAYER_PREVIEW");
});

test("source disclosures show recorded-session notes and exact source-record details safely", () => {
  const { value, plan, source, desk } = attributedPrep();
  delete plan.tasks[0].provenance.sourceDeskId;
  source.recap = '<script>unsafe notes</script> Saved source notes';
  const view = prepViewHarness(value);
  const recorded = view.prepProvenanceMarkup(value, plan.tasks[0]);
  assert.match(recorded, /Saved source session notes/);
  assert.match(recorded, /&lt;script&gt;unsafe notes&lt;\/script&gt;/);
  assert.doesNotMatch(recorded, /data-open-session-desk=|<script>/);
  value.quests.push({ localId: "quest-source", title: "Same quest title", detail: '<svg onload="unsafe()"> Exact source detail' }, { localId: "quest-other", title: "Same quest title", detail: "UNRELATED_QUEST_DETAIL" });
  const row = { provenance: { key: "quest-source", sourceCollection: "quests", sourceRowId: "quest-source", recordRef: { type: "quest", localId: "quest-source", name: "Same quest title" } } };
  const recordMarkup = view.prepProvenanceMarkup(value, row);
  assert.match(recordMarkup, /Saved details for this source record/);
  assert.match(recordMarkup, /Exact source detail/);
  assert.doesNotMatch(recordMarkup, /<svg|UNRELATED_QUEST_DETAIL|data-open-entity/);
  desk.status = "active";
  assert.doesNotMatch(view.prepProvenanceMarkup(value, plan.scenes[0]), /data-open-session-desk=/);
});

test("saved template guidance stays distinct from prepared text and exports only unfinished prompts safely", () => {
  const value = campaign(), plan = filledPrep(value);
  plan.prompts = { opening: "AnsweredOpeningPrompt", secret: "UnsupportedPrompt" };
  plan.scenes[0].prompts = { title: "AnsweredTitlePrompt", detail: '<img src=x onerror="unsafe()"> [Map](https://example.test)', question: "AnsweredChoicePrompt", secret: "UnsupportedPrompt" };
  plan.scenes[0].detail = "";
  plan.tasks.push({ id: "unfinished-guidance", text: "", done: false, prompts: { text: "UnfinishedTaskPrompt" } });
  plan.templateReview = { id: "review", rows: [{ after: { title: "UnappliedTemplateDraft" } }] };
  const restored = prep.normalizePrep(JSON.parse(JSON.stringify(plan)));
  assert.equal(restored.scenes[0].detail, "");
  assert.equal(restored.scenes[0].prompts.detail, plan.scenes[0].prompts.detail);
  assert.equal(restored.prompts.secret, undefined);
  assert.equal(restored.scenes[0].prompts.secret, undefined);
  assert.deepEqual(restored.templateReview, plan.templateReview);
  assert.notEqual(restored.templateReview, plan.templateReview);
  assert.equal(prep.readiness(restored, value).checks.find(check => check.id === "tasks").done, false);

  const before = JSON.stringify(value);
  const packet = prep.exportMarkdown(value, value.sessions[0], restored);
  const [prepared, unfinished] = packet.split("## Planning prompts still to develop");
  assert.match(prepared, /At the gate/);
  assert.doesNotMatch(prepared, /UnfinishedTaskPrompt|&lt;img/);
  assert.match(unfinished, /&lt;img src=x/);
  assert(unfinished.includes("\\[Map\\]\\(https://example\\.test\\)"));
  assert.match(unfinished, /UnfinishedTaskPrompt/);
  assert.doesNotMatch(packet, /Answered\w+Prompt|UnsupportedPrompt|UnappliedTemplateDraft|<img/);
  const markup = prepViewHarness(value).sessionPrepView(value);
  assert.match(markup, /Planning prompts/);
  assert.match(markup, /&lt;img src=x/);
  assert.doesNotMatch(markup, /<img|UnsupportedPrompt|UnappliedTemplateDraft/);
  assert.equal(JSON.stringify(value), before);
});
