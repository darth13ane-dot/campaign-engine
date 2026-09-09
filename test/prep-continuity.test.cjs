const test = require("node:test");
const assert = require("node:assert/strict");
const prep = require("../session-prep.js");
const workflow = require("../session-workflow.js");
const continuity = require("../prep-continuity.js");
const archivist = require("../archivist-merge.js");

function fixture() {
  const campaign = {
    id: "campaign", title: "The Crossing",
    sessions: [{ localId: "target", title: "Beyond the river", number: 2, upcoming: true, recap: "A new opening" }, { localId: "source", title: "At the gate", number: 1, upcoming: false, recap: "The party bargained with Vale." }],
    characters: [{ localId: "guard", name: "Vale", voice: "Quiet" }],
    quests: [{ localId: "quest", title: "Find the ferryman", status: "Active", detail: "Follow the trail to the mill." }, { localId: "done", title: "Completed quest", status: "Done", detail: "Already settled." }],
    arcs: [{ id: "arc", title: "The rising water", status: "Active", tension: "The river is rising.", nextStep: "Find who operates the sluices." }, { id: "held", title: "Held arc", status: "On hold", nextStep: "Return later." }],
    locations: [], journal: [], connections: []
  };
  const target = campaign.sessions[0], source = campaign.sessions[1];
  workflow.ensureWorkflow(campaign);
  const sourcePrep = prep.ensurePrep(campaign, source);
  sourcePrep.scenes = [{ id: "unused", title: "The locked mill", kind: "exploration", minutes: 45, detail: "The miller has barricaded the doors.", question: "Negotiate or take another route?" }, { id: "played", title: "The gate bargain", kind: "social", minutes: 20, detail: "A toll is demanded.", question: "" }];
  sourcePrep.revelations = [{ id: "unrevealed", text: "A tunnel reaches the mill.", checked: false }, { id: "discovered", text: "Vale knows the ferryman.", checked: false }];
  sourcePrep.clocks = [{ id: "active-clock", label: "Rising water", value: 1, max: 6 }, { id: "completed-clock", label: "The watch arrives", value: 0, max: 4 }];
  sourcePrep.tasks = [{ id: "unfinished", text: "Draw the tunnel map", done: false }, { id: "finished", text: "Prepare Vale", done: true }];
  sourcePrep.spotlights = [{ id: "spotlight", character: "Mira", opportunity: "Recognize the old flood marks." }];
  sourcePrep.pinned = [{ type: "character", name: "Vale", localId: "guard" }];
  const desk = workflow.startDesk(campaign, source, "2026-09-08T18:00:00.000Z");
  desk.beats[1].done = true;
  desk.revelations[1].checked = true;
  desk.clocks[0].value = 3;
  desk.clocks[1].value = 4;
  desk.log.push({ id: "log", at: "2026-09-08T18:15:00.000Z", text: "The gate opens after a bargain." });
  desk.scratch = "The party still has the relic.";
  workflow.endDesk(campaign, desk.id, "2026-09-08T21:00:00.000Z");
  sourcePrep.scenes.push({ id: "later-prep", title: "A scene added after play", kind: "scene", minutes: 30, detail: "This was never in the live desk.", question: "" });
  const targetPrep = prep.ensurePrep(campaign, target);
  targetPrep.opening = "Keep my existing opening.";
  targetPrep.scenes.push({ id: "existing", title: "Our chosen opening", kind: "scene", minutes: 15, detail: "Already prepared.", question: "" });
  return { campaign, source, target, sourcePrep, targetPrep, desk };
}
const candidate = (review, collection) => review.candidates.find(item => item.collection === collection);
const accepted = row => ({ id: row.id, accepted: true });

test("review uses ended live completion and progress, excludes completed originals, and selects nothing", () => {
  const { campaign, target, desk } = fixture();
  const before = JSON.stringify(campaign);
  const review = continuity.buildReview(campaign, target);
  assert.equal(review.source.deskId, desk.id);
  assert.equal(review.source.kind, "ended");
  assert.equal(review.source.recap, "The party bargained with Vale.");
  assert.equal(review.source.log[0].text, "The gate opens after a bargain.");
  assert(review.candidates.every(row => row.selected === false && row.before === null));
  assert.equal(candidate(review, "clocks").after.value, 3);
  assert(review.candidates.some(row => row.label === "The locked mill"));
  for (const label of ["The gate bargain", "Vale knows the ferryman.", "The watch arrives", "Prepare Vale", "A scene added after play", "Completed quest", "Held arc"]) assert(!review.candidates.some(row => row.label === label), label);
  assert.equal(review.target.counts.scenes, 1);
  assert.equal(JSON.stringify(campaign), before);
});

test("recorded-only campaigns offer earlier preparation and directions without asserting live outcomes", () => {
  const { campaign, source, target, desk, sourcePrep } = fixture();
  delete campaign.sessionWorkflow.desks[desk.id];
  const options = continuity.sourceSessions(campaign, target);
  assert.equal(options[0].kind, "recorded");
  assert.equal(options[0].deskId, null);
  const review = continuity.buildReview(campaign, target, { sourceSessionRef: prep.sessionReference(source) });
  assert.equal(review.source.kind, "recorded");
  assert.match(candidate(review, "scenes").reason, /Prepared earlier; no live progress recorded/);
  assert(review.candidates.some(row => row.label === "The gate bargain"));
  sourcePrep.scenes = [];
  source.directions = ["Explore the old canal."];
  const directions = continuity.buildReview(campaign, target, { sourceSessionRef: prep.sessionReference(source) });
  assert(directions.candidates.some(row => row.provenance.sourceCollection === "directions" && /No live completion/.test(row.evidence[0])));
});

test("active source desks are excluded and an explicit recorded source still respects an ended desk", () => {
  const { campaign, source, target, desk } = fixture();
  const endedReview = continuity.buildReview(campaign, target, { sourceSessionRef: prep.sessionReference(source) });
  assert.equal(endedReview.source.deskId, desk.id);
  assert(!endedReview.candidates.some(row => row.label === "The gate bargain"));
  desk.status = "active";
  assert.deepEqual(continuity.sourceSessions(campaign, target), []);
  assert.throws(() => continuity.buildReview(campaign, target, { sourceDeskId: desk.id }), /unavailable/);
  assert.throws(() => continuity.buildReview(campaign, target, { sourceSessionRef: prep.sessionReference(source) }), /Active sessions/);
});

test("current-campaign-only review supports campaigns with no played session or prior prep", () => {
  const { campaign, target } = fixture();
  campaign.sessions = [target];
  campaign.sessionWorkflow = { schemaVersion: 2, preps: {}, desks: {}, reconciliations: {} };
  const before = JSON.stringify(campaign);
  const review = continuity.buildReview(campaign, target);
  assert.equal(review.source, null);
  assert.deepEqual(review.candidates.map(row => row.category), ["quests", "arcs"]);
  assert(review.candidates.every(row => row.collection === "scenes" && !row.selected));
  assert.equal(review.candidates[0].provenance.recordRef.localId, "quest");
  const result = continuity.applyReview(campaign, target, review, [accepted(review.candidates[0])]);
  assert.equal(prep.findPrepForSession(result.campaign, result.campaign.sessions[0]).scenes.length, 1);
  assert.deepEqual(result.campaign.sessionWorkflow.desks, {});
  assert.equal(JSON.stringify(campaign), before);
});

test("only explicitly accepted edited rows append to prep, preserving canon, source, and existing target work", () => {
  const { campaign, target, source, targetPrep } = fixture();
  const review = continuity.buildReview(campaign, target);
  targetPrep.continuityReview = review;
  const scene = candidate(review, "scenes"), clue = candidate(review, "revelations");
  scene.after.title = "An adapted mill scene";
  scene.after.detail = "A choice for the next session.";
  const before = JSON.stringify(campaign), sourceBefore = structuredClone(source), targetBefore = structuredClone(targetPrep);
  assert.throws(() => continuity.applyReview(campaign, target, review, []), /Select and accept/);
  assert.throws(() => continuity.applyReview(campaign, target, review, [{ id: scene.id, accepted: "true" }]), /Select and accept/);
  const result = continuity.applyReview(campaign, target, review, [{ ...accepted(scene), after: { ...scene.after, id: "forged", provenance: { key: "forged" }, archivistId: "forged" } }, { id: clue.id, accepted: false }]);
  const nextPrep = prep.findPrepForSession(result.campaign, result.campaign.sessions[0]);
  assert.equal(result.added.length, 1);
  assert.equal(nextPrep.scenes[1].title, "An adapted mill scene");
  assert.equal(nextPrep.scenes[1].detail, "A choice for the next session.");
  assert.notEqual(nextPrep.scenes[1].id, "forged");
  assert.equal(nextPrep.scenes[1].provenance.key, scene.provenance.key);
  assert.equal(nextPrep.scenes[1].archivistId, undefined);
  assert.deepEqual(nextPrep.revelations, []);
  assert.equal(nextPrep.opening, targetBefore.opening);
  assert.deepEqual(nextPrep.scenes[0], targetBefore.scenes[0]);
  assert.equal(nextPrep.continuityReview, undefined);
  assert.deepEqual(result.campaign.sessions[1], sourceBefore);
  for (const collection of ["sessions", "characters", "quests", "arcs"]) assert.deepEqual(result.campaign[collection], campaign[collection]);
  assert.deepEqual(result.campaign.sessionWorkflow.desks, campaign.sessionWorkflow.desks);
  assert.equal(JSON.stringify(campaign), before);
});

test("stale source, target, and current thread changes reject atomically while review editing stays valid", () => {
  for (const change of [state => state.desk.beats[0].detail = "Changed at source", state => state.targetPrep.opening = "Changed target", state => state.campaign.quests[0].detail = "Changed quest"]) {
    const state = fixture(), review = continuity.buildReview(state.campaign, state.target);
    const row = candidate(review, "scenes");
    change(state);
    const before = JSON.stringify(state.campaign);
    assert.equal(continuity.validateReview(state.campaign, state.target, review).valid, false);
    assert.throws(() => continuity.applyReview(state.campaign, state.target, review, [accepted(row)]), /changed during review/);
    assert.equal(JSON.stringify(state.campaign), before);
  }
  const { campaign, target, targetPrep, sourcePrep } = fixture();
  const review = continuity.buildReview(campaign, target);
  targetPrep.continuityReview = review;
  targetPrep.updatedAt = "Later save";
  sourcePrep.updatedAt = "Other save";
  review.candidates[0].after.detail = "A GM-reviewed adaptation";
  review.candidates[0].selected = true;
  assert.equal(continuity.validateReview(campaign, target, review).valid, true);
});

test("stable source and target renames survive review, while lost IDs and ambiguous legacy names reject", () => {
  const { campaign, source, target, desk } = fixture();
  const review = continuity.buildReview(campaign, target);
  prep.ensureSessionReferences(campaign, source);
  prep.ensureSessionReferences(campaign, target);
  source.title = "Renamed source";
  target.title = "Renamed target";
  assert.equal(continuity.validateReview(campaign, target, review).valid, true);
  const result = continuity.applyReview(campaign, target, review, [accepted(candidate(review, "scenes"))]);
  assert.equal(result.campaign.sessions[0].title, "Renamed target");
  delete campaign.sessionWorkflow.desks[desk.id];
  assert.throws(() => continuity.applyReview(campaign, target, review, [accepted(candidate(review, "scenes"))]), /source desk/);
  campaign.sessions[1] = { localId: "replacement", title: "Renamed source", number: 1 };
  assert.equal(continuity.validateReview(campaign, target, review).valid, false);
  assert.throws(() => continuity.buildReview(campaign, target, { sourceSessionRef: prep.sessionReference(source) }), /source session is missing/);
  const legacy = fixture();
  legacy.campaign.sessions.push({ localId: "same-name", title: legacy.source.title, number: 1 });
  assert.throws(() => continuity.buildReview(legacy.campaign, legacy.target, { sourceSessionRef: { name: legacy.source.title, number: 1 } }), /ambiguous/);
});

test("review and provenance survive JSON normalization and approved Archivist refresh", () => {
  const { campaign, target, targetPrep } = fixture();
  campaign.source = "archivist";
  const review = continuity.buildReview(campaign, target);
  review.candidates[0].after.detail = "Review this adaptation later.";
  targetPrep.continuityReview = review;
  const restored = JSON.parse(JSON.stringify(campaign));
  restored.sessionWorkflow = workflow.normalizeWorkflow(restored.sessionWorkflow);
  const restoredPrep = prep.findPrepForSession(restored, restored.sessions[0]);
  assert.equal(continuity.validateReview(restored, restored.sessions[0], restoredPrep.continuityReview).valid, true);
  const result = continuity.applyReview(restored, restored.sessions[0], restoredPrep.continuityReview, [accepted(restoredPrep.continuityReview.candidates[0])]);
  const incoming = structuredClone(result.campaign);
  incoming.sessionWorkflow = {};
  const refresh = archivist.createReview([result.campaign], [incoming], {}, {});
  const merged = archivist.applyReview(refresh, [result.campaign]).campaigns[0];
  const carried = prep.findPrepForSession(merged, merged.sessions[0]).scenes.at(-1);
  assert.equal(carried.detail, "Review this adaptation later.");
  assert.equal(carried.provenance.key, review.candidates[0].provenance.key);
});

test("origin membership prevents duplicates through A to B to C, and removing a row permits intentional re-add", () => {
  const first = fixture();
  const aReview = continuity.buildReview(first.campaign, first.target);
  const aScene = aReview.candidates.find(row => row.provenance.sourceRowId === "unused");
  const toB = continuity.applyReview(first.campaign, first.target, aReview, [accepted(aScene)]);
  const campaign = toB.campaign, b = campaign.sessions[0], a = campaign.sessions[1];
  const bDesk = workflow.startDesk(campaign, b, "2026-09-09T18:00:00.000Z");
  workflow.endDesk(campaign, bDesk.id, "2026-09-09T21:00:00.000Z");
  b.upcoming = false;
  const c = { localId: "target-c", title: "The old canal", number: 3, upcoming: true };
  campaign.sessions.unshift(c);
  const direct = continuity.buildReview(campaign, c, { sourceSessionRef: prep.sessionReference(a) });
  const directScene = direct.candidates.find(row => row.provenance.sourceRowId === "unused");
  const toC = continuity.applyReview(campaign, c, direct, [accepted(directScene)]);
  const restored = JSON.parse(JSON.stringify(toC.campaign));
  restored.sessionWorkflow = workflow.normalizeWorkflow(restored.sessionWorkflow);
  const transit = continuity.buildReview(restored, restored.sessions[0], { sourceDeskId: bDesk.id });
  const original = transit.candidates.find(row => row.provenance.key === aScene.provenance.key);
  assert(original);
  assert.equal(original.duplicate, true);
  const skipped = continuity.applyReview(restored, restored.sessions[0], transit, [accepted(original)]);
  assert.equal(skipped.added.length, 0);
  assert.equal(skipped.skipped.length, 1);
  const cPrep = prep.findPrepForSession(skipped.campaign, skipped.campaign.sessions[0]);
  assert.equal(cPrep.scenes.length, 1);
  cPrep.scenes = [];
  const retry = continuity.buildReview(skipped.campaign, skipped.campaign.sessions[0], { sourceDeskId: bDesk.id });
  const retryRow = retry.candidates.find(row => row.provenance.key === aScene.provenance.key);
  assert.equal(retryRow.duplicate, false);
  assert.equal(continuity.applyReview(skipped.campaign, skipped.campaign.sessions[0], retry, [accepted(retryRow)]).added.length, 1);
});

test("evidence names only actually executed proposal IDs, omitting unapproved projections and legacy uncertain batches", () => {
  const { campaign, target, desk } = fixture();
  const draft = workflow.createReconciliation(campaign, desk.id, [
    { id: "executed", approved: true, action: "update", collection: "quests", target: { name: "Find the ferryman" }, field: "status", before: "Active", after: "Done", summary: "The ferryman was found", evidence: ["The session log records his rescue."] },
    { id: "approved-not-selected", approved: true, action: "update", collection: "characters", target: { name: "Vale" }, field: "voice", before: "Quiet", after: "Loud", summary: "A projected voice change", evidence: ["A guess"] }
  ]);
  const next = workflow.applyApproved(campaign, draft.id, ["executed"]);
  next.sessionWorkflow.reconciliations.legacy = { id: "legacy", deskId: desk.id, status: "applied", proposals: [{ id: "legacy-guess", approved: true, summary: "Legacy projected betrayal" }] };
  next.sessionWorkflow.reconciliations.pending = { id: "pending", deskId: desk.id, status: "draft", proposals: [{ id: "unapplied", approved: true, summary: "Still a projection" }] };
  const review = continuity.buildReview(next, target);
  assert.deepEqual(review.source.appliedConsequences.map(row => row.id), ["executed"]);
  assert.equal(review.source.appliedConsequences[0].summary, "The ferryman was found");
  assert.match(review.source.consequenceNote, /no record of the exact selected proposals/);
  assert.doesNotMatch(JSON.stringify(review.source), /projected voice|projected betrayal|Still a projection/);
  assert.equal(next.characters[0].voice, "Quiet");
});

test("forged candidate IDs reject and existing live target state remains independent of prep application", () => {
  const { campaign, target } = fixture();
  const targetDesk = workflow.startDesk(campaign, target);
  targetDesk.scratch = "Keep live notes";
  targetDesk.beats[0].done = true;
  const beforeDesk = structuredClone(targetDesk);
  const review = continuity.buildReview(campaign, target);
  assert.equal(review.target.hasLiveDesk, true);
  assert.throws(() => continuity.applyReview(campaign, target, review, [{ id: "forged", accepted: true }]), /no longer available/);
  const scene = candidate(review, "scenes");
  scene.collection = "characters";
  scene.provenance.key = "forged";
  const result = continuity.applyReview(campaign, target, review, [accepted(scene)]);
  assert.deepEqual(result.campaign.sessionWorkflow.desks[targetDesk.id], beforeDesk);
  assert.deepEqual(result.campaign.characters, campaign.characters);
  assert.notEqual(prep.findPrepForSession(result.campaign, result.campaign.sessions[0]).scenes.at(-1).provenance.key, "forged");
});

test("review remains valid after normalization adds defaults to a beat captured during live play", () => {
  const { campaign, target, targetPrep, desk } = fixture();
  desk.beats.push({ id: "improvised", kind: "beat", title: "An improvised lead", done: false });
  const review = continuity.buildReview(campaign, target);
  targetPrep.continuityReview = review;
  const restored = JSON.parse(JSON.stringify(campaign));
  restored.sessionWorkflow = workflow.normalizeWorkflow(restored.sessionWorkflow);
  const savedReview = prep.findPrepForSession(restored, restored.sessions[0]).continuityReview;
  assert.equal(continuity.validateReview(restored, restored.sessions[0], savedReview).valid, true);
  const row = savedReview.candidates.find(item => item.label === "An improvised lead");
  assert.equal(continuity.applyReview(restored, restored.sessions[0], savedReview, [accepted(row)]).added.length, 1);
});

test("a uniquely resolved legacy pin already in target prep is not duplicated by a stable source reference", () => {
  const { campaign, target, targetPrep } = fixture();
  targetPrep.pinned.push({ type: "character", name: "Vale" });
  const review = continuity.buildReview(campaign, target);
  const pin = candidate(review, "pinned");
  assert.equal(pin.duplicate, true);
  const result = continuity.applyReview(campaign, target, review, [accepted(pin)]);
  assert.equal(result.added.length, 0);
  assert.equal(prep.findPrepForSession(result.campaign, result.campaign.sessions[0]).pinned.length, 1);
});

test("recorded preparation keeps its origins after its source later starts and ends live play", () => {
  const { campaign, source, target, desk } = fixture();
  delete campaign.sessionWorkflow.desks[desk.id];
  const recorded = continuity.buildReview(campaign, target, { sourceSessionRef: prep.sessionReference(source) });
  const earlier = recorded.candidates.filter(row => !["quests", "arcs"].includes(row.category));
  const result = continuity.applyReview(campaign, target, recorded, earlier.map(accepted));
  const next = result.campaign;
  const laterDesk = workflow.startDesk(next, next.sessions[1]);
  laterDesk.beats.push({ id: "live-only-scene", title: "A new lead captured during play", kind: "beat", done: false });
  workflow.endDesk(next, laterDesk.id);
  const endedReview = continuity.buildReview(next, next.sessions[0], { sourceDeskId: laterDesk.id });
  for (const row of earlier) {
    const sameOrigin = endedReview.candidates.find(item => item.provenance.key === row.provenance.key);
    assert(sameOrigin, `${row.category}: ${row.label}`);
    assert.equal(sameOrigin.duplicate, true, row.label);
  }
  const liveOnly = endedReview.candidates.find(row => row.provenance.sourceRowId === "live-only-scene");
  assert.equal(liveOnly.duplicate, false);
  const applied = continuity.applyReview(next, next.sessions[0], endedReview, endedReview.candidates.filter(row => row.duplicate).map(accepted));
  assert.equal(applied.added.length, 0);
  assert.equal(applied.skipped.length, earlier.length);
});

test("a recorded possible direction and its synthesized live beat share one origin", () => {
  const { campaign, source, target, sourcePrep, desk } = fixture();
  delete campaign.sessionWorkflow.desks[desk.id];
  sourcePrep.scenes = [];
  source.directions = ["Explore the old canal."];
  const recorded = continuity.buildReview(campaign, target, { sourceSessionRef: prep.sessionReference(source) });
  const direction = recorded.candidates.find(row => row.provenance.sourceCollection === "directions");
  const result = continuity.applyReview(campaign, target, recorded, [accepted(direction)]);
  const laterDesk = workflow.startDesk(result.campaign, result.campaign.sessions[1]);
  workflow.endDesk(result.campaign, laterDesk.id);
  const endedReview = continuity.buildReview(result.campaign, result.campaign.sessions[0], { sourceDeskId: laterDesk.id });
  const sameOrigin = endedReview.candidates.find(row => row.provenance.key === direction.provenance.key);
  assert(sameOrigin);
  assert.equal(sameOrigin.duplicate, true);
});
