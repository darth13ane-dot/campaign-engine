const test = require("node:test");
const assert = require("node:assert/strict");
const workflow = require("../session-workflow.js");

function campaign() {
  return {
    id: "campaign-1",
    sessions: [{ title: "The Crossing", number: 4, upcoming: true, directions: ["Reach the gate"] }],
    characters: [{ archivistId: "char-1", name: "Vale", description: "Original", localOverrides: { voice: "Quiet" } }],
    quests: [{ id: "local-quest", title: "Find the road", detail: "Old", status: "Active" }],
    locations: [], journal: [], arcs: [], connections: []
  };
}

test("normalizes legacy workflow state without adding state to unused campaigns", () => {
  const untouched = campaign();
  workflow.normalizeCampaign(untouched);
  assert.equal(untouched.sessionWorkflow, undefined);

  const migrated = campaign();
  migrated.sessionDeskState = { sessions: [{ id: "desk-old", sessionTitle: "The Crossing", beats: [{ text: "Open the door" }] }] };
  workflow.normalizeCampaign(migrated);
  assert.equal(migrated.sessionWorkflow.schemaVersion, 2);
  assert.deepEqual(migrated.sessionWorkflow.preps, {});
  assert.equal(migrated.sessionWorkflow.desks["desk-old"].beats[0].title, "Open the door");
  assert.equal(migrated.sessionDeskState, undefined);
});

test("starts, resumes, and explicitly ends a session desk", () => {
  const value = campaign();
  const first = workflow.startDesk(value, value.sessions[0], "2026-07-18T20:00:00.000Z");
  first.log.push({ id: "log-1", at: "2026-07-18T20:01:00.000Z", text: "The gate opened." });
  const resumed = workflow.startDesk(value, value.sessions[0]);
  assert.equal(resumed.id, first.id);
  assert.equal(resumed.status, "active");
  assert.equal(resumed.log[0].text, "The gate opened.");
  workflow.endDesk(value, first.id, "2026-07-18T22:00:00.000Z");
  assert.equal(first.status, "ended");
  assert.equal(first.endedAt, "2026-07-18T22:00:00.000Z");
});

test("sanitizes proposals and rejects unsupported mutation shapes", () => {
  const proposals = workflow.sanitizeProposals([
    { action: "update", collection: "quests", target: { name: "Find the road" }, field: "status", before: "Active", after: "Done", evidence: ["The party found it."] },
    { action: "update", collection: "quests", target: { name: "Find the road" }, field: "__proto__", before: "", after: "bad", evidence: ["No"] },
    { action: "create", collection: "unknown", record: { title: "Bad" }, evidence: ["No"] },
    { action: "update", collection: "quests", target: { name: "Find the road" }, field: "status", after: "Done", evidence: [] }
  ]);
  assert.equal(proposals.length, 1);
  assert.equal(proposals[0].after, "Done");
});

test("only approved selected proposals mutate canon and Archivist overrides are preserved", () => {
  const value = campaign();
  const desk = workflow.startDesk(value, value.sessions[0]);
  workflow.endDesk(value, desk.id);
  const draft = workflow.createReconciliation(value, desk.id, [
    { id: "p1", action: "update", collection: "characters", target: { name: "Vale", archivistId: "char-1" }, field: "description", before: "Original", after: "Changed", evidence: ["Vale confessed."] },
    { id: "p2", action: "update", collection: "quests", target: { name: "Find the road", id: "local-quest" }, field: "status", before: "Active", after: "Done", evidence: ["The road was found."] }
  ]);
  draft.proposals[0].approved = true;
  const applied = workflow.applyApproved(value, draft.id, ["p1", "p2"]);
  assert.equal(applied.characters[0].archivistId, "char-1");
  assert.equal(applied.characters[0].description, "Changed");
  assert.deepEqual(applied.characters[0].localOverrides, { voice: "Quiet", description: "Changed" });
  assert.equal(applied.quests[0].status, "Active");
  assert.equal(value.characters[0].description, "Original");
  assert.deepEqual(applied.sessionWorkflow.reconciliations[draft.id].appliedProposalIds, ["p1"]);
});

test("reconciliation audit records only the approved proposals actually selected for application", () => {
  const value = campaign();
  const desk = workflow.startDesk(value, value.sessions[0]);
  workflow.endDesk(value, desk.id);
  const draft = workflow.createReconciliation(value, desk.id, [
    { id: "selected", approved: true, action: "update", collection: "quests", target: { id: "local-quest" }, field: "detail", before: "Old", after: "New", evidence: ["New lead recorded"] },
    { id: "unselected", approved: true, action: "update", collection: "quests", target: { id: "local-quest" }, field: "status", before: "Active", after: "Done", evidence: ["GM has not chosen this update"] }
  ]);
  const applied = workflow.applyApproved(value, draft.id, ["selected"]);
  assert.equal(applied.quests[0].detail, "New");
  assert.equal(applied.quests[0].status, "Active");
  assert.equal(draft.status, "draft");
  const saved = workflow.normalizeWorkflow(JSON.parse(JSON.stringify(applied.sessionWorkflow)));
  assert.deepEqual(saved.reconciliations[draft.id].appliedProposalIds, ["selected"]);
  delete applied.sessionWorkflow.reconciliations[draft.id].appliedProposalIds;
  assert.equal(Object.hasOwn(workflow.normalizeWorkflow(applied.sessionWorkflow).reconciliations[draft.id], "appliedProposalIds"), false);
});

test("carried material keeps its original source through prep, live play and workspace normalization", () => {
  const prep = require("../session-prep.js");
  const value = campaign();
  workflow.ensureWorkflow(value);
  const plan = prep.ensurePrep(value, value.sessions[0]);
  const provenance = { key: "origin:session-3:scene-1", sourceDeskId: "desk-previous", sourceSessionRef: { localId: "session-3", name: "Previous session", number: 3 }, sourceCollection: "beats", sourceRowId: "scene-1", label: "Previously prepared" };
  plan.scenes.push({ id: "s", title: "Meet Vale", detail: "Ask about the road", kind: "social", minutes: 20, provenance });
  plan.revelations.push({ id: "r", text: "The road is blocked", checked: false, provenance });
  plan.clocks.push({ id: "c", label: "Watch suspicion", value: 2, max: 6, provenance });
  plan.spotlights.push({ id: "pc", character: "Vale", opportunity: "Recognize a traveller", provenance });
  plan.pinned.push({ type: "character", name: "Vale", archivistId: "char-1", provenance });
  const desk = workflow.startDesk(value, value.sessions[0]);
  desk.beats[0].done = true;
  desk.clocks[0].value = 3;
  const saved = workflow.normalizeWorkflow(JSON.parse(JSON.stringify(value.sessionWorkflow)));
  for (const collection of ["beats", "revelations", "clocks", "spotlights", "pinned"]) assert.deepEqual(saved.desks[desk.id][collection][0].provenance, provenance);
  assert.equal(saved.desks[desk.id].beats[0].done, true);
  assert.equal(saved.desks[desk.id].clocks[0].value, 3);
  assert.equal(saved.preps[plan.id].clocks[0].value, 2);
});

test("stale proposals fail safely and remain recoverable", () => {
  const value = campaign();
  const desk = workflow.startDesk(value, value.sessions[0]);
  workflow.endDesk(value, desk.id);
  const draft = workflow.createReconciliation(value, desk.id, [{ id: "p1", action: "update", collection: "quests", target: { name: "Find the road", id: "local-quest" }, field: "detail", before: "Old", after: "New", evidence: ["The log says so."] }]);
  draft.proposals[0].approved = true;
  value.quests[0].detail = "GM edited this later";
  assert.throws(() => workflow.applyApproved(value, draft.id, ["p1"]), /changed after this proposal/);
  assert.equal(draft.status, "draft");
  assert.match(draft.error, /changed after this proposal/);
  assert.equal(value.quests[0].detail, "GM edited this later");
});

test("session desks retain local identity through renames and distinguish duplicate titles", () => {
  const value = campaign();
  value.sessions[0].localId = "session-first";
  value.sessions.push({ ...value.sessions[0], localId: "session-second" });
  const first = workflow.startDesk(value, value.sessions[0]);
  const second = workflow.startDesk(value, value.sessions[1]);
  assert.notEqual(first.id, second.id);
  value.sessions[0].title = "Beyond the Crossing";
  assert.equal(workflow.findDeskForSession(value, value.sessions[0]).id, first.id);
  assert.equal(workflow.findDeskForSession(value, value.sessions[1]).id, second.id);
  assert.equal(workflow.startDesk(value, value.sessions[0]).id, first.id);
});

test("resuming a unique legacy desk upgrades its reference without resetting play", () => {
  const value = campaign();
  value.sessions[0].localId = "session-first";
  value.sessionWorkflow = { schemaVersion: 1, desks: { old: { id: "old", sessionRef: { name: "The Crossing", number: 4 }, status: "ended", startedAt: "2026-07-01T10:00:00.000Z", endedAt: "2026-07-01T12:00:00.000Z", scratch: "Keep this", beats: [{ id: "b", title: "Gate", done: true }], revelations: [{ id: "r", text: "The guard lied", checked: true }], log: [{ id: "l", at: "2026-07-01T11:00:00.000Z", text: "Gate opened" }] } }, reconciliations: {} };
  const resumed = workflow.startDesk(value, value.sessions[0]);
  assert.equal(resumed.id, "old");
  assert.equal(resumed.sessionRef.localId, "session-first");
  assert.equal(resumed.status, "ended");
  assert.equal(resumed.scratch, "Keep this");
  assert.equal(resumed.beats[0].done, true);
  assert.equal(resumed.revelations[0].checked, true);
  assert.equal(resumed.log[0].text, "Gate opened");
  assert.equal(resumed.startedAt, "2026-07-01T10:00:00.000Z");
  assert.equal(resumed.endedAt, "2026-07-01T12:00:00.000Z");
  value.sessions[0].title = "Renamed";
  assert.equal(workflow.findDeskForSession(value, value.sessions[0]).id, "old");
});
