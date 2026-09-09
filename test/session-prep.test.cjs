const test = require("node:test");
const assert = require("node:assert/strict");
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
