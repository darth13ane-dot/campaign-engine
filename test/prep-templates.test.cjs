const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const templates = require("../prep-templates.js");
const prepCore = require("../session-prep.js");
const workflow = require("../session-workflow.js");
const continuity = require("../prep-continuity.js");

function campaign(system = "wfrp4e") {
  const value = {
    id: "campaign-1", system, title: "SECRET_CAMPAIGN",
    sessions: [{ localId: "session-1", title: "SECRET_SESSION", number: 3, upcoming: true, recap: "SECRET_CANON" }],
    characters: [{ localId: "char-1", name: "SECRET_PERSON", role: "PC" }],
    quests: [], locations: [], journal: [], arcs: [], connections: []
  };
  workflow.ensureWorkflow(value);
  prepCore.ensurePrep(value, value.sessions[0]);
  return value;
}
function plan(value) { return prepCore.findPrepForSession(value, value.sessions[0]); }
function starter(id = "builtin-investigation") { return templates.builtins().find(template => template.id === id); }
function review(value, template = starter()) {
  const next = templates.buildReview(value, value.sessions[0], template);
  plan(value).templateReview = next;
  return next;
}
function freeze(value) {
  if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}

test("six original system-neutral starters return independent instructional structures with optional scenes", () => {
  const list = templates.builtins();
  assert.deepEqual(list.map(item => item.id), ["builtin-investigation", "builtin-social-event", "builtin-exploration", "builtin-dungeon-expedition", "builtin-heist", "builtin-downtime"]);
  for (const item of list) {
    assert.equal(item.builtin, true);
    assert.ok(item.openingPrompt);
    assert.equal(item.scenes.length, 5);
    assert.equal(item.scenes.filter(scene => scene.optional).length, 1);
    assert.ok(item.scenes.every(scene => scene.prompts.title && scene.prompts.detail && scene.prompts.question));
    assert.ok(item.scenes.reduce((sum, scene) => sum + scene.minutes, 0) <= item.durationMinutes);
    for (const row of item.scenes) for (const field of ["title", "detail", "question", "id", "provenance"]) assert.equal(row[field], undefined);
  }
  list[0].scenes[0].prompts.title = "Changed outside the library";
  assert.notEqual(templates.builtins()[0].scenes[0].prompts.title, list[0].scenes[0].prompts.title);
  for (const system of ["wfrp4e", "pf2e", "dnd5e", "custom"]) {
    const value = campaign(system), draft = templates.buildReview(value, value.sessions[0], starter());
    assert.equal(draft.useDuration, false);
    assert.equal(draft.rows.filter(row => row.collection === "scenes" && !row.selected).length, 1);
    assert.equal(draft.rows.find(row => row.collection === "opening").after.opening, "");
    assert.ok(draft.rows.filter(row => row.collection === "scenes").every(row => row.after.title === "" && row.after.detail === "" && row.after.question === ""));
  }
});

test("workspace library saves detached custom drafts, supports duplicate/delete, and preserves edit references", () => {
  const state = { campaigns: [campaign(), { ...campaign(), id: "campaign-2" }], activeCampaignId: "campaign-1" };
  const library = templates.ensureLibrary(state), draft = templates.duplicateTemplate(starter(), { name: "My investigation" });
  assert.equal(Object.keys(library.templates).length, 0);
  assert.equal(draft.builtin, undefined);
  assert.notEqual(draft.id, starter().id);
  const saved = templates.saveTemplate(library, draft);
  assert.equal(templates.ensureLibrary(state), library);
  assert.equal(library.templates[draft.id], saved);
  state.activeCampaignId = "campaign-2";
  assert.equal(templates.listTemplates(templates.ensureLibrary(state)).find(item => item.id === draft.id).name, "My investigation");
  const listed = templates.listTemplates(library); listed.find(item => item.id === draft.id).name = "Unsaved edit";
  assert.equal(saved.name, "My investigation");
  assert.throws(() => templates.saveTemplate(library, starter()), /Duplicate a built-in/);
  const restored = JSON.parse(JSON.stringify(state));
  assert.deepEqual(templates.ensureLibrary(restored), library);
  assert.equal(templates.deleteTemplate(library, draft.id), true);
  assert.equal(templates.deleteTemplate(library, draft.id), false);
  assert.equal(templates.builtins().length, 6);
});

test("future library or template schemas preserve raw workspace data and fail before mutation", () => {
  for (const raw of [{ schemaVersion: 2, templates: { future: { text: "Preserve me" } } }, { schemaVersion: 1, templates: { future: { schemaVersion: 2, id: "future", name: "Preserve me" } } }]) {
    const state = { prepTemplates: raw }, before = structuredClone(state);
    assert.throws(() => templates.ensureLibrary(state), /unsupported schema/);
    assert.equal(state.prepTemplates, raw);
    assert.deepEqual(state, before);
  }
  const library = templates.normalizeLibrary();
  assert.throws(() => templates.saveTemplate(library, { schemaVersion: 2, name: "Future" }), /unsupported schema/);
  assert.deepEqual(library.templates, {});
});

test("library normalization keeps colliding imported copies and protects built-in identities and prototype keys", () => {
  const custom = templates.duplicateTemplate(starter()), other = { ...structuredClone(custom), name: "Second copy" };
  const raw = JSON.parse(JSON.stringify({ schemaVersion: 1, templates: { one: custom, two: other, reserved: { ...custom, id: "builtin-investigation", name: "Imported custom" }, special: { ...custom, id: "__proto__", name: "Special key" } } }));
  const before = structuredClone(raw), library = templates.normalizeLibrary(raw), values = Object.values(library.templates);
  assert.equal(values.length, 4);
  assert.equal(new Set(values.map(value => value.id)).size, 4);
  assert.ok(values.every(value => value.id !== "builtin-investigation"));
  assert.equal(Object.hasOwn(library.templates, "__proto__"), true);
  assert.equal(Object.getPrototypeOf(library.templates), Object.prototype);
  assert.deepEqual(templates.normalizeLibrary(library), library);
  assert.deepEqual(raw, before);
});

test("capture transfers only shape and numeric settings and never reads campaign prose, identities, prompts, pins or progress", () => {
  const forbidden = () => { throw new Error("Read forbidden campaign material"); };
  const guard = (value, fields) => { for (const field of fields) Object.defineProperty(value, field, { enumerable: true, get: forbidden }); return value; };
  const original = guard({
    durationMinutes: 210,
    scenes: [guard({ kind: "social", minutes: 35 }, ["id", "title", "detail", "question", "prompts", "provenance", "done"]), guard({ kind: "combat", minutes: 55 }, ["id", "title", "detail", "question", "prompts", "provenance"])],
    revelations: [guard({}, ["id", "text", "checked", "prompts", "provenance"])],
    clocks: [guard({ max: 8 }, ["id", "label", "value", "prompts", "provenance"])],
    spotlights: [guard({}, ["id", "character", "opportunity", "prompts", "provenance"])],
    tasks: [guard({}, ["id", "text", "done", "prompts", "provenance"])]
  }, ["id", "sessionRef", "opening", "prompts", "pinned", "templateReview", "continuityReview", "approval"]);
  const captured = templates.captureStructure(original);
  assert.equal(captured.name, "Saved prep structure");
  assert.equal(captured.durationMinutes, 210);
  assert.deepEqual(captured.scenes.map(scene => [scene.kind, scene.minutes]), [["social", 35], ["combat", 55]]);
  assert.equal(captured.clocks[0].max, 8);
  for (const collection of ["revelations", "clocks", "spotlights", "tasks"]) assert.equal(captured[collection].length, 1);
  assert.ok(captured.openingPrompt);
  assert.ok(captured.scenes[0].prompts.title);
  assert.equal(captured.pinned, undefined);
  assert.equal(captured.sessionRef, undefined);
});

test("captured secret sentinels cannot enter generic templates or other campaign preparation", () => {
  const value = campaign(), original = plan(value);
  Object.assign(original, {
    opening: "SECRET_OPENING", prompts: { opening: "SECRET_PROMPT" }, durationMinutes: 120,
    scenes: [{ id: "SECRET_ROW", title: "SECRET_TITLE", detail: "SECRET_DETAIL", question: "SECRET_QUESTION", kind: "social", minutes: 35, prompts: { title: "SECRET_GUIDE" }, provenance: { key: "SECRET_ORIGIN" } }],
    pinned: [{ type: "character", localId: "SECRET_RECORD_ID", name: "SECRET_RECORD" }],
    revelations: [{ id: "SECRET_CLUE", text: "SECRET_TRUTH", checked: true }],
    clocks: [{ id: "SECRET_CLOCK", label: "SECRET_CLOCK_LABEL", max: 6, value: 5 }],
    spotlights: [{ id: "SECRET_SPOTLIGHT", character: "SECRET_PLAYER", opportunity: "SECRET_OPPORTUNITY" }],
    tasks: [{ id: "SECRET_TASK", text: "SECRET_TASK_TEXT", done: true }]
  });
  const before = structuredClone(original), captured = templates.captureStructure(original, { name: "My general outline" });
  assert.doesNotMatch(JSON.stringify(captured), /SECRET_/);
  assert.deepEqual(original, before);
  const another = campaign("custom"); another.id = "other-campaign";
  const draft = review(another, captured), applied = templates.applyReview(another, another.sessions[0], captured, draft).prep;
  const transferred = { opening: applied.opening, scenes: applied.scenes, revelations: applied.revelations, clocks: applied.clocks, spotlights: applied.spotlights, tasks: applied.tasks, pinned: applied.pinned, prompts: applied.prompts };
  assert.doesNotMatch(JSON.stringify(transferred), /SECRET_/);
  assert.equal(applied.clocks[0].value, 0);
  assert.equal(applied.revelations[0].checked, false);
  assert.equal(applied.tasks[0].done, false);
  assert.deepEqual(applied.pinned, []);
});

test("template scaffolds keep guidance separate from authored readiness and from the first live desk", () => {
  const value = campaign(), source = starter(), draft = review(value, source);
  const applied = templates.applyReview(value, value.sessions[0], source, draft).prep;
  const status = prepCore.readiness(applied, value), prompts = templates.promptProgress(applied);
  assert.ok(prompts.total > 20);
  assert.deepEqual(prompts, { remaining: prompts.total, total: prompts.total, completed: 0 });
  for (const check of status.checks) assert.equal(check.done, false, check.id);
  assert.equal(applied.scenes.length, 4);
  assert.ok(applied.scenes.every(scene => scene.title === "" && scene.detail === "" && scene.question === ""));
  const desk = workflow.startDesk(value, value.sessions[0]);
  assert.deepEqual(desk.beats, []); assert.deepEqual(desk.clocks, []); assert.deepEqual(desk.revelations, []); assert.deepEqual(desk.spotlights, []);
  assert.equal(desk.opening, "");
  applied.opening = "The bridge bell rings.";
  applied.scenes[0].title = "At the bridge";
  applied.scenes[0].question = "Cross before the gates shut?";
  const after = templates.promptProgress(applied);
  assert.equal(after.completed, 3);
  assert.equal(after.remaining, prompts.total - 3);
  assert.equal(prepCore.readiness(applied, value).checks.find(check => check.id === "opening").done, true);
});

test("selected edited rows append fresh identities and reset progress while keeping existing prep, canon and live state", () => {
  const value = campaign(), existing = plan(value), source = starter();
  Object.assign(existing, { opening: "Existing opening. ", prompts: { opening: "Existing guidance." }, durationMinutes: 95 });
  existing.scenes.push({ id: "old-scene", kind: "scene", title: "Existing scene", minutes: 20, detail: "Existing details", question: "A current choice?" });
  existing.pinned.push({ type: "character", name: "SECRET_PERSON", localId: "char-1" });
  const desk = workflow.startDesk(value, value.sessions[0]); desk.scratch = "Played events"; desk.beats[0].done = true;
  const before = structuredClone(value), draft = review(value, source);
  assert.equal(draft.target.hasLiveDesk, true);
  draft.rows.forEach(row => row.selected = false);
  const opening = draft.rows.find(row => row.collection === "opening"); opening.selected = true; opening.after.opening = "An additional authored paragraph.";
  const scene = draft.rows.find(row => row.collection === "scenes");
  scene.selected = true; Object.assign(scene.after, { id: "old-scene", title: "A new scene", detail: "A changed situation", minutes: 45, done: true, provenance: { key: "forged" }, pinned: [{ name: "Injected" }] });
  const clock = draft.rows.find(row => row.collection === "clocks"); clock.selected = true; Object.assign(clock.after, { label: "Watch arrives", max: 7, value: 6 });
  const task = draft.rows.find(row => row.collection === "tasks"); task.selected = true; Object.assign(task.after, { text: "Prepare the bridge map", done: true });
  const clue = draft.rows.find(row => row.collection === "revelations"); clue.selected = true; Object.assign(clue.after, { text: "The bell is a warning", checked: true });
  const result = templates.applyReview(value, value.sessions[0], source, draft);
  assert.equal(result.prep, existing);
  assert.equal(result.added.length, 5);
  assert.equal(existing.opening, "Existing opening. \n\nAn additional authored paragraph.");
  assert.equal(existing.prompts.opening, `Existing guidance.\n\n${source.openingPrompt}`);
  assert.equal(existing.durationMinutes, 95);
  assert.deepEqual(existing.scenes[0], before.sessionWorkflow.preps[existing.id].scenes[0]);
  assert.notEqual(existing.scenes[1].id, "old-scene");
  assert.equal(existing.scenes[1].minutes, 45);
  assert.equal(existing.scenes[1].provenance, undefined);
  assert.equal(existing.scenes[1].pinned, undefined);
  assert.equal(existing.clocks[0].value, 0);
  assert.equal(existing.tasks[0].done, false);
  assert.equal(existing.revelations[0].checked, false);
  assert.deepEqual(value.sessionWorkflow.desks, before.sessionWorkflow.desks);
  for (const key of ["sessions", "characters", "quests", "locations", "journal", "arcs", "connections"]) assert.deepEqual(value[key], before[key]);
  assert.deepEqual(existing.pinned, before.sessionWorkflow.preps[existing.id].pinned);
  assert.deepEqual(source, starter());
  assert.equal(existing.templateReview, undefined);
});

test("duration replacement is explicit and empty selection causes no mutation", () => {
  const value = campaign(), source = starter("builtin-downtime");
  plan(value).durationMinutes = 120;
  const draft = review(value, source);
  draft.rows.forEach(row => row.selected = false);
  const before = structuredClone(value);
  assert.throws(() => templates.applyReview(value, value.sessions[0], source, draft), /Select template entries/);
  assert.deepEqual(value, before);
  draft.useDuration = true;
  const result = templates.applyReview(value, value.sessions[0], source, draft);
  assert.deepEqual(result.added, []);
  assert.equal(result.prep.durationMinutes, 120);
  assert.deepEqual(result.prep.scenes, []);
  // The material snapshot did not change, so this proves the saved-review
  // consumption check itself rejects a repeated application.
  assert.throws(() => templates.applyReview(value, value.sessions[0], source, draft), /no longer saved/);
});

test("saved review consumption prevents replay while an explicit fresh review permits intentional reuse", () => {
  const value = campaign(), source = starter(), unsaved = templates.buildReview(value, value.sessions[0], source);
  assert.throws(() => templates.applyReview(value, value.sessions[0], source, unsaved), /no longer saved/);
  const first = review(value, source);
  templates.applyReview(value, value.sessions[0], source, first);
  const count = plan(value).scenes.length, before = structuredClone(value);
  assert.throws(() => templates.applyReview(value, value.sessions[0], source, first), /changed|no longer saved/);
  assert.deepEqual(value, before);
  const second = review(value, source);
  assert.notEqual(second.id, first.id);
  templates.applyReview(value, value.sessions[0], source, second);
  assert.equal(plan(value).scenes.length, count * 2);
  assert.equal(new Set(plan(value).scenes.map(scene => scene.id)).size, count * 2);
});

test("stale source, target prep and live status reject application without mutation while pending edits remain valid", () => {
  const changes = [
    (value, source) => source.scenes[0].prompts.title = "Changed template instructions",
    (value, source) => source.durationMinutes = 60,
    value => plan(value).opening = "New authored prep",
    value => plan(value).scenes.push({ id: "new", title: "New scene" }),
    value => workflow.startDesk(value, value.sessions[0])
  ];
  for (const change of changes) {
    const value = campaign(), source = starter(), draft = review(value, source);
    draft.rows[0].after.opening = "A reviewed addition";
    plan(value).updatedAt = "A UI timestamp";
    plan(value).continuityReview = { id: "an-independent-review", snapshot: "UI state only" };
    assert.equal(templates.validateReview(value, value.sessions[0], source, draft).valid, true);
    change(value, source);
    const before = structuredClone(value);
    assert.equal(templates.validateReview(value, value.sessions[0], source, draft).valid, false);
    assert.throws(() => templates.applyReview(value, value.sessions[0], source, draft), /changed/);
    assert.deepEqual(value, before);
  }
});

test("target references survive rename and refuse missing, duplicate or cross-campaign identities", () => {
  const value = campaign(), source = starter(), draft = review(value, source);
  prepCore.ensureSessionReferences(value, value.sessions[0]); value.sessions[0].title = "Renamed session"; value.sessions[0].number = 9;
  plan(value).sessionRef = prepCore.sessionReference(value.sessions[0]);
  assert.equal(templates.validateReview(value, value.sessions[0], source, draft).valid, true);
  const changed = structuredClone(value); changed.id = "other-campaign";
  assert.equal(templates.validateReview(changed, changed.sessions[0], source, draft).valid, false);
  const replacement = structuredClone(value); replacement.sessions[0].localId = "new-session";
  assert.equal(templates.validateReview(replacement, replacement.sessions[0], source, draft).valid, false);
  const duplicate = structuredClone(value); duplicate.sessions.push({ ...duplicate.sessions[0] });
  assert.equal(templates.validateReview(duplicate, duplicate.sessions[0], source, draft).valid, false);
  assert.equal(templates.validateReview(value, value.sessions[0], null, draft).valid, false);
});

test("forged or duplicated review rows and stale saved-review identity fail atomically", () => {
  for (const corrupt of [draft => draft.rows.push({ id: "forged", collection: "pinned", selected: true, after: { name: "Injected" } }), draft => draft.rows.push(structuredClone(draft.rows[0])), draft => draft.rows[1].collection = "opening"]) {
    const value = campaign(), source = starter(), draft = review(value, source); corrupt(draft);
    const before = structuredClone(value);
    assert.throws(() => templates.applyReview(value, value.sessions[0], source, draft), /unavailable|duplicated/);
    assert.deepEqual(value, before);
  }
  const value = campaign(), source = starter(), draft = review(value, source);
  plan(value).templateReview = { ...draft, id: "another-saved-review" };
  assert.throws(() => templates.applyReview(value, value.sessions[0], source, draft), /no longer saved/);
});

test("pending review and applied prompt metadata survive JSON and prep normalization without recursive review snapshots", () => {
  const value = campaign(), source = starter(), draft = review(value, source);
  draft.rows[1].after.title = "An authored bridge scene";
  const saved = JSON.parse(JSON.stringify(value));
  saved.sessionWorkflow = workflow.normalizeWorkflow(saved.sessionWorkflow);
  const restored = plan(saved).templateReview;
  assert.deepEqual(restored, draft);
  assert.equal(templates.validateReview(saved, saved.sessions[0], source, restored).valid, true);
  const result = templates.applyReview(saved, saved.sessions[0], source, restored).prep;
  const normalized = prepCore.normalizePrep(JSON.parse(JSON.stringify(result)));
  assert.deepEqual(normalized, result);
  assert.equal(normalized.scenes[0].title, "An authored bridge scene");
  assert.ok(normalized.scenes[0].prompts.detail);
  saved.sessions.push({ localId: "previous", title: "Previous", number: 1, upcoming: false, recap: "Earlier session" });
  const nextTemplate = review(saved, source), carry = continuity.buildReview(saved, saved.sessions[0], { sourceDeskId: null });
  result.continuityReview = carry;
  const rebuilt = templates.buildReview(saved, saved.sessions[0], source);
  assert.equal(rebuilt.snapshot.target, nextTemplate.snapshot.target);
  assert.doesNotMatch(rebuilt.snapshot.target, /templateReview|continuityReview/);
});

test("read-only template operations leave frozen data untouched and browser API has pure prep, source and starter dependencies", () => {
  const value = freeze(campaign()), source = freeze(starter()), before = JSON.stringify(value);
  templates.buildReview(value, value.sessions[0], source);
  templates.captureStructure(plan(value));
  templates.promptProgress(plan(value));
  assert.equal(JSON.stringify(value), before);
  const context = vm.createContext({ structuredClone, crypto: require("node:crypto").webcrypto });
  for (const file of ["prep-sources.js", "session-prep.js", "prep-template-starters.js", "prep-templates.js"]) vm.runInContext(fs.readFileSync(path.join(__dirname, "..", file), "utf8"), context, { filename: file });
  assert.equal(context.CampaignSessionWorkflow, undefined);
  assert.equal(context.CampaignPlayerPacket, undefined);
  const browser = context.CampaignPrepTemplates;
  assert.equal(browser.builtins().length, 6);
  assert.deepEqual(JSON.parse(JSON.stringify(browser.buildReview(value, value.sessions[0], source).snapshot)), templates.buildReview(value, value.sessions[0], source).snapshot);
});
