const test = require("node:test");
const assert = require("node:assert/strict");
const table = require("../session-table.js");
const prep = require("../session-prep.js");
const workflow = require("../session-workflow.js");
const continuity = require("../prep-continuity.js");
const notes = require("../prep-notes.js");
const preview = require("../player-preview.js");

function fixture() {
  const campaign = { id: "table-campaign", title: "River road", system: "Custom", sessions: [{ localId: "session", title: "The bridge", number: 1, upcoming: true, recap: "Mara owes the party a favor." }], characters: [{ archivistId: "mara", name: "Mara", description: "Find my brother", knowledge: "gm" }, { localId: "another", name: "Mara", description: "A different person", knowledge: "gm" }], locations: [{ localId: "bridge", title: "Old bridge", detail: "Toll keeper and rising river" }], quests: [], journal: [], arcs: [], connections: [] };
  workflow.ensureWorkflow(campaign);
  const session = campaign.sessions[0], plan = prep.ensurePrep(campaign, session);
  plan.scenes.push({ id: "scene-one", title: "At the bridge", kind: "social", minutes: 30, detail: "Negotiate the toll", question: "Pay or find another way?" }, { id: "scene-two", title: "Across the river", kind: "exploration", minutes: 30, detail: "Search the bank", question: "Follow the tracks?" });
  return { campaign, session, plan };
}
const mara = { type: "character", name: "Mara", archivistId: "mara" };

test("scene references are stable, deduplicated and copied independently into first play", () => {
  const f = fixture(), before = structuredClone(f.campaign.characters);
  assert.equal(table.addSceneReference(f.campaign, f.plan.scenes[0], mara), true);
  assert.equal(table.addSceneReference(f.campaign, f.plan.scenes[0], mara), false);
  const normalized = prep.normalizePrep(f.plan);
  assert.deepEqual(normalized.scenes[0].references, [mara]);
  const desk = workflow.startDesk(f.campaign, f.session);
  assert.deepEqual(desk.beats[0].references, [mara]);
  assert.notEqual(desk.beats[0].references, f.plan.scenes[0].references);
  table.removeSceneReference(f.plan.scenes[0], prep.referenceKey(mara));
  assert.deepEqual(desk.beats[0].references, [mara]);
  assert.deepEqual(f.campaign.characters, before);
  assert.equal(workflow.startDesk(f.campaign, f.session), desk);
});

test("same-name characters remain distinct and missing sources remain visible without replacement capture", () => {
  const f = fixture();
  assert.throws(() => table.addSceneReference(f.campaign, f.plan.scenes[0], { type: "character", name: "Mara" }), /stable identity/);
  table.addSceneReference(f.campaign, f.plan.scenes[0], mara);
  const desk = workflow.startDesk(f.campaign, f.session);
  desk.pinned.push({ type: "character", localId: "another", name: "Mara" });
  let refs = table.references(f.campaign, desk);
  assert.equal(refs.length, 2);
  assert.equal(refs[0].record.description, "Find my brother");
  assert.equal(refs[1].record.description, "A different person");
  f.campaign.characters.shift();
  refs = table.references(f.campaign, desk);
  assert.equal(refs[0].record, null);
  assert.equal(refs[0].ref.archivistId, "mara");
});

test("focused scene survives reordering and normalization, falling back only when unavailable", () => {
  const f = fixture(), desk = workflow.startDesk(f.campaign, f.session);
  table.focusScene(desk, "scene-two");
  desk.beats.reverse();
  f.campaign.sessionWorkflow = workflow.normalizeWorkflow(f.campaign.sessionWorkflow);
  const loaded = Object.values(f.campaign.sessionWorkflow.desks)[0];
  assert.equal(table.focusedScene(loaded).id, "scene-two");
  loaded.beats = loaded.beats.filter(row => row.id !== "scene-two");
  assert.equal(table.focusedScene(loaded).id, "scene-one");
  assert.throws(() => table.focusScene(loaded, "scene-two"), /missing/);
  loaded.beats.push({ ...loaded.beats[0] });
  assert.equal(table.focusedScene(loaded), null);
});

test("all quick-capture drafts preserve typing and survive workspace normalization", () => {
  const f = fixture(), desk = workflow.startDesk(f.campaign, f.session);
  const drafts = { logText: "  Mara agrees.\nA further thought… ", sceneTitle: "The ferry", sceneKind: "social", clockLabel: "River rising", clockMax: "6", revelationText: "The seal was copied." };
  for (const [key, value] of Object.entries(drafts)) table.setDraft(desk, key, value);
  const loaded = workflow.normalizeWorkflow(JSON.parse(JSON.stringify(f.campaign.sessionWorkflow))).desks[desk.id];
  for (const [key, value] of Object.entries(drafts)) assert.equal(loaded.tableDrafts[key], value);
  assert.equal(loaded.tableDrafts.logSceneRef.id, "scene-one");
  assert.equal(desk.log.length, 0);
  assert.deepEqual(f.plan.scenes.length, 2);
});

test("committing a log draft is single-use and retains its original scene when focus changes", () => {
  const f = fixture(), desk = workflow.startDesk(f.campaign, f.session);
  table.setDraft(desk, "logText", "Mara agrees.");
  table.setDraft(desk, "clockLabel", "River rising");
  table.focusScene(desk, "scene-two");
  const first = table.commitDraft(desk, "log", "2026-09-20T12:00:00.000Z");
  assert.equal(first.sceneRef.id, "scene-one");
  assert.equal(first.sceneRef.title, "At the bridge");
  assert.equal(desk.tableDrafts.clockLabel, "River rising");
  assert.equal(desk.tableDrafts.logText, "");
  assert.throws(() => table.commitDraft(desk, "log"), /Write the note/);
  table.setDraft(desk, "logText", "We found the trail.");
  const second = table.commitDraft(desk, "log", first.at);
  assert.notEqual(first.id, second.id);
  assert.equal(second.sceneRef.id, "scene-two");
  assert.equal(workflow.normalizeWorkflow(f.campaign.sessionWorkflow).desks[desk.id].log[0].sceneRef.id, "scene-one");
});

test("ended sessions reject draft writes and commits while retaining pending text for review", () => {
  const f = fixture(), desk = workflow.startDesk(f.campaign, f.session);
  table.setDraft(desk, "logText", "Pending thought");
  workflow.endDesk(f.campaign, desk.id);
  const before = JSON.stringify(desk);
  assert.throws(() => table.setDraft(desk, "logText", "Changed"), /ended/);
  assert.throws(() => table.commitDraft(desk, "log"), /ended/);
  assert.throws(() => table.focusScene(desk, "scene-two"), /ended/);
  assert.equal(JSON.stringify(desk), before);
  assert.equal(table.focusedScene(desk).id, "scene-one");
});

test("scene, clock and clue capture clear only their committed field and constrain values", () => {
  const f = fixture(), desk = workflow.startDesk(f.campaign, f.session);
  for (const [key, value] of Object.entries({ sceneTitle: "The ferry", sceneKind: "social", clockLabel: "River rising", clockMax: "999", revelationText: "A copied seal", logText: "Still writing" })) table.setDraft(desk, key, value);
  const scene = table.commitDraft(desk, "scene"), clock = table.commitDraft(desk, "clock"), revelation = table.commitDraft(desk, "revelation");
  assert.equal(scene.kind, "social"); assert.equal(scene.done, false);
  assert.equal(clock.max, 20); assert.equal(clock.value, 0);
  assert.equal(revelation.checked, false);
  assert.equal(desk.tableDrafts.logText, "Still writing");
  assert.equal(desk.tableDrafts.sceneTitle, "");
  assert.equal(desk.tableDrafts.clockLabel, "");
  assert.equal(desk.tableDrafts.revelationText, "");
});

test("scene-only records count toward readiness and include details in the GM packet", () => {
  const f = fixture(); table.addSceneReference(f.campaign, f.plan.scenes[0], mara);
  assert.equal(prep.readiness(f.plan, f.campaign).checks.find(check => check.id === "records").done, true);
  const md = prep.exportMarkdown(f.campaign, f.session, f.plan);
  assert.match(md, /At hand/); assert.match(md, /Find my brother/);
  f.campaign.characters.shift();
  assert.equal(prep.readiness(f.plan, f.campaign).checks.find(check => check.id === "records").done, false);
  assert.match(prep.exportMarkdown(f.campaign, f.session, f.plan), /unavailable/);
  assert.doesNotMatch(prep.exportMarkdown(f.campaign, f.session, f.plan), /A different person/);
});

test("approved notes attach only cited stable records to a scene when pinning was selected", () => {
  for (const pinSources of [true, false]) {
    const f = fixture(), book = notes.ensureWorkbench(f.campaign, f.session);
    const source = notes.addSource(f.campaign, f.session, mara);
    book.draft = notes.createDraft(f.campaign, f.session); book.draft.pinSources = pinSources;
    const row = notes.newRow("scenes", source);
    row.after = { title: "Mara's request", detail: "She asks for help", question: "Will the party accept?", kind: "social", minutes: 20 };
    book.draft.rows.push(row); notes.applyDraft(f.campaign, f.session);
    assert.deepEqual(f.plan.scenes.at(-1).references || [], pinSources ? [mara] : []);
  }
});

test("private table focus, drafts and references remain outside player projection", () => {
  const f = fixture(); table.addSceneReference(f.campaign, f.plan.scenes[0], mara);
  const desk = workflow.startDesk(f.campaign, f.session); table.setDraft(desk, "logText", "PRIVATE_TABLE_DRAFT");
  const projected = JSON.stringify(preview.projectCampaign(f.campaign));
  assert.doesNotMatch(projected, /PRIVATE_TABLE_DRAFT|focusedBeatId|sessionWorkflow|Find my brother/);
});

test("unfinished scenes carry their linked records into the following session without changing the source", () => {
  const f = fixture(); table.addSceneReference(f.campaign, f.plan.scenes[0], mara);
  const desk = workflow.startDesk(f.campaign, f.session);
  workflow.endDesk(f.campaign, desk.id);
  const target = { localId: "next", title: "Following the river", number: 2, upcoming: true };
  f.campaign.sessions.push(target); prep.ensurePrep(f.campaign, target);
  const before = JSON.stringify(desk), review = continuity.buildReview(f.campaign, target, { sourceDeskId: desk.id });
  const candidate = review.candidates.find(row => row.collection === "scenes" && row.after.title === "At the bridge");
  assert.deepEqual(candidate.after.references, [mara]);
  const result = continuity.applyReview(f.campaign, target, review, [{ id: candidate.id, accepted: true }]);
  const next = prep.findPrepForSession(result.campaign, prep.findSession(result.campaign, prep.sessionReference(target)));
  assert.deepEqual(next.scenes[0].references, [mara]);
  assert.equal(JSON.stringify(desk), before);
});
