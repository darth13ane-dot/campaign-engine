const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const templates = require("../prep-templates.js");
const persistence = require("../workspace-persistence.js");
const prep = require("../session-prep.js");
const workflow = require("../session-workflow.js");
const { createWorkspaceStore } = require("../electron/workspace-store.cjs");

async function temporaryStore(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "campaign-template-test-"));
  t.after(async () => {
    assert.equal(path.dirname(path.resolve(directory)), path.resolve(os.tmpdir()));
    assert(path.basename(directory).startsWith("campaign-template-test-"));
    await fs.rm(directory, { recursive: true, force: true });
  });
  return { directory, store: createWorkspaceStore({ directory, appVersion: "1.8.0" }) };
}

function campaign(id, system) {
  return {
    id, title: `${system} campaign`, system,
    sessions: [{ localId: `${id}-session`, title: "Next session", number: 2, upcoming: true, recap: "Existing recap" }],
    characters: [{ localId: `${id}-pc`, name: "Mira", role: "PC", description: "Existing character" }],
    quests: [{ localId: `${id}-quest`, title: "The crossing", status: "Active", detail: "Existing objective" }],
    locations: [], journal: [], arcs: [], connections: []
  };
}
function workspaceState() {
  return { activeCampaignId: "first", campaigns: [campaign("first", "WFRP 4e"), campaign("second", "PF2e")], appearance: { theme: "midnight" } };
}
function customTemplate(name = "A crossing to prepare") {
  return templates.createTemplate({
    name, summary: "Plan a route and a meaningful decision.", durationMinutes: 120,
    openingPrompt: "Describe an obstacle and two visible approaches.",
    scenes: [{ kind: "exploration", minutes: 30, prompts: { title: "Name the crossing.", detail: "Describe costs the PCs can assess.", question: "What alternatives can they choose?" } }],
    revelations: [{ prompts: { text: "Place a useful route clue." } }],
    clocks: [{ max: 4, prompts: { label: "Name a pressure and its visible triggers." } }],
    spotlights: [{ prompts: { character: "Choose a PC.", opportunity: "Invite them to interpret the terrain." } }],
    tasks: [{ prompts: { text: "Sketch the viable routes." } }]
  });
}

test("global custom prep templates survive save, export, import, reopen, and campaign switches", async t => {
  const { directory, store } = await temporaryStore(t);
  const state = workspaceState(), canon = structuredClone(state.campaigns);
  const library = templates.ensureLibrary(state), custom = customTemplate();
  templates.saveTemplate(library, custom);
  const archivist = { importedAt: "2026-09-09", campaigns: { first: { sessions: { "Next session": { notes: "Private source notes" } } } } };
  await store.initializeWorkspace({ state, archivist });
  state.activeCampaignId = "second";
  templates.saveTemplate(library, { ...custom, name: "My reusable crossing", durationMinutes: 150 });
  const second = customTemplate("An alternate crossing");
  templates.saveTemplate(library, second);
  const expected = structuredClone(state);
  await store.saveState(state);
  const reopened = createWorkspaceStore({ directory, appVersion: "1.8.1" });
  assert.deepEqual((await reopened.loadWorkspace()).state, expected);
  const exported = path.join(directory, "template-workspace.json");
  await reopened.exportWorkspace(exported);

  const destinationDirectory = path.join(directory, "restored");
  const destination = createWorkspaceStore({ directory: destinationDirectory, appVersion: "1.8.1" });
  await destination.initializeWorkspace({ state: workspaceState(), archivist: {} });
  await destination.importWorkspace(exported);
  const restoredStore = createWorkspaceStore({ directory: destinationDirectory, appVersion: "1.8.2" });
  const restored = await restoredStore.loadWorkspace();
  assert.deepEqual(restored.state, expected);
  assert.deepEqual(restored.archivist, archivist);
  assert((await fs.readdir(destination.backupDirectory)).some(name => name.includes("before-import")));
  const restoredLibrary = templates.ensureLibrary(restored.state);
  for (const campaignId of ["first", "second", "first"]) {
    restored.state.activeCampaignId = campaignId;
    assert.equal(templates.listTemplates(restoredLibrary).find(item => item.id === custom.id).name, "My reusable crossing");
    assert(templates.listTemplates(restoredLibrary).some(item => item.id === second.id));
  }
  assert.deepEqual(restored.state.campaigns, canon);
  assert.deepEqual(state, expected);
});

test("browser restoration preserves a template-only workspace without inserting sample campaigns", () => {
  const populated = workspaceState();
  templates.saveTemplate(templates.ensureLibrary(populated), customTemplate());
  assert.deepEqual(persistence.initialState(JSON.parse(JSON.stringify(populated)), [], workspaceState()), populated);
  const saved = { ...structuredClone(populated), campaigns: [] }, before = structuredClone(saved);
  for (const snapshot of [[], [campaign("imported", "Custom")]]) {
    const restored = persistence.initialState(saved, snapshot, workspaceState());
    assert.deepEqual(restored.prepTemplates, populated.prepTemplates);
    assert.equal(restored.campaigns.length, 0);
    assert.equal(templates.listTemplates(templates.ensureLibrary(restored)).filter(item => item.id === Object.keys(populated.prepTemplates.templates)[0]).length, 1);
    assert.deepEqual(saved, before);
  }
});

test("unsupported future template-library data remains intact on disk when normalization rejects it", async t => {
  const { directory, store } = await temporaryStore(t);
  const state = workspaceState();
  state.prepTemplates = { schemaVersion: 999, templates: {}, futureOnlyData: "Preserve this library" };
  await store.initializeWorkspace({ state });
  const before = await fs.readFile(store.workspacePath, "utf8");
  const restored = (await createWorkspaceStore({ directory, appVersion: "1.8.0" }).loadWorkspace()).state;
  const original = structuredClone(restored);
  assert.throws(() => templates.ensureLibrary(restored), /schema|version|newer|unsupported/i);
  assert.deepEqual(restored, original);
  assert.equal(await fs.readFile(store.workspacePath, "utf8"), before);
});

test("restored template review applies only selected prep additions and preserves source canon and live play", async t => {
  const { directory, store } = await temporaryStore(t);
  const state = workspaceState(), [source, target] = state.campaigns;
  state.campaigns.forEach(value => workflow.ensureWorkflow(value));
  const sourcePrep = prep.ensurePrep(source, source.sessions[0]);
  Object.assign(sourcePrep, {
    opening: "PRIVATE_SOURCE_OPENING", durationMinutes: 210,
    scenes: [{ id: "source-scene", title: "PRIVATE_SOURCE_TITLE", detail: "PRIVATE_SOURCE_DETAIL", question: "PRIVATE_SOURCE_QUESTION", kind: "social", minutes: 35 }],
    revelations: [{ id: "source-clue", text: "PRIVATE_SOURCE_CLUE", checked: true }],
    clocks: [{ id: "source-clock", label: "PRIVATE_SOURCE_CLOCK", value: 3, max: 6 }],
    spotlights: [{ id: "source-spotlight", character: "PRIVATE_SOURCE_PC", opportunity: "PRIVATE_SOURCE_OPPORTUNITY" }],
    tasks: [{ id: "source-task", text: "PRIVATE_SOURCE_TASK", done: true }],
    pinned: [{ type: "character", name: "Mira", localId: "first-pc" }]
  });
  const originalSource = structuredClone(source);
  const template = templates.captureStructure(sourcePrep, { name: "Reusable social crossing" });
  assert.doesNotMatch(JSON.stringify(template), /PRIVATE_SOURCE_|source-scene|first-pc/);
  const library = templates.ensureLibrary(state);
  templates.saveTemplate(library, template);
  const targetPrep = prep.ensurePrep(target, target.sessions[0]);
  targetPrep.opening = "Keep the GM's existing opening.";
  targetPrep.scenes.push({ id: "existing-scene", title: "Existing scene", detail: "Keep this authored situation.", question: "What will the PCs do?", kind: "social", minutes: 20 });
  targetPrep.tasks.push({ id: "existing-task", text: "Existing completed work", done: true });
  const desk = workflow.startDesk(target, target.sessions[0]);
  desk.beats[0].done = true;
  desk.scratch = "Keep the live notes.";
  const originalDesk = structuredClone(desk), originalCanon = structuredClone(target.sessions);
  const review = templates.buildReview(target, target.sessions[0], template);
  review.rows.forEach(row => { row.selected = ["scenes", "clocks", "revelations"].includes(row.collection); });
  review.rows.find(row => row.collection === "revelations").after.text = "A clue written for this target session.";
  review.useDuration = false;
  targetPrep.templateReview = review;
  const savedReview = structuredClone(review), originalTemplate = structuredClone(template);
  await store.initializeWorkspace({ state });
  await store.saveState(state);
  const exported = path.join(directory, "template-review-workspace.json");
  await store.exportWorkspace(exported);
  const restoredDirectory = path.join(directory, "restored-review");
  await createWorkspaceStore({ directory: restoredDirectory, appVersion: "1.8.0" }).importWorkspace(exported);
  const restored = (await createWorkspaceStore({ directory: restoredDirectory, appVersion: "1.8.1" }).loadWorkspace()).state;
  restored.campaigns.forEach(value => workflow.ensureWorkflow(value));
  const restoredTarget = restored.campaigns[1], restoredPrep = prep.findPrepForSession(restoredTarget, restoredTarget.sessions[0]);
  const restoredLibrary = templates.ensureLibrary(restored);
  const restoredTemplate = templates.listTemplates(restoredLibrary).find(value => value.id === template.id);
  assert.deepEqual(restoredPrep.templateReview, savedReview);
  assert.equal(restoredPrep.scenes.length, 1, "Saved review rows remain pending before explicit application");
  assert.equal(templates.validateReview(restoredTarget, restoredTarget.sessions[0], restoredTemplate, restoredPrep.templateReview).valid, true);
  const result = templates.applyReview(restoredTarget, restoredTarget.sessions[0], restoredTemplate, restoredPrep.templateReview);
  assert.deepEqual(result.added, ["scenes:0", "revelations:0", "clocks:0"]);
  assert.equal(restoredPrep.templateReview, undefined);
  assert.equal(restoredPrep.opening, "Keep the GM's existing opening.");
  assert.equal(restoredPrep.durationMinutes, 180);
  assert.equal(restoredPrep.scenes.length, 2);
  assert.equal(restoredPrep.scenes[0].detail, "Keep this authored situation.");
  assert.equal(restoredPrep.scenes[1].title, "");
  assert.equal(restoredPrep.scenes[1].detail, "");
  assert.equal(restoredPrep.scenes[1].question, "");
  assert(restoredPrep.scenes[1].prompts.detail);
  assert.notEqual(restoredPrep.scenes[1].id, "source-scene");
  assert.equal(restoredPrep.revelations[0].text, "A clue written for this target session.");
  assert.equal(restoredPrep.revelations[0].checked, false);
  assert.equal(restoredPrep.clocks[0].value, 0);
  assert.equal(restoredPrep.clocks[0].max, 6);
  assert.equal(restoredPrep.clocks[0].label, "");
  assert.equal(restoredPrep.tasks.length, 1);
  assert.equal(restoredPrep.tasks[0].done, true);
  assert.equal(restoredPrep.spotlights.length, 0);
  assert.deepEqual(restored.campaigns[0], originalSource);
  assert.deepEqual(restoredTarget.sessions, originalCanon);
  assert.deepEqual(restoredTarget.sessionWorkflow.desks[desk.id], originalDesk);
  assert.deepEqual(restoredLibrary.templates[template.id], originalTemplate);
  assert.deepEqual(source, originalSource);
  assert.deepEqual(template, originalTemplate);
  const applied = structuredClone(restoredPrep);
  const restoredStore = createWorkspaceStore({ directory: restoredDirectory, appVersion: "1.8.1" });
  await restoredStore.saveState(restored);
  const afterRestart = (await createWorkspaceStore({ directory: restoredDirectory, appVersion: "1.8.2" }).loadWorkspace()).state;
  afterRestart.campaigns.forEach(value => workflow.ensureWorkflow(value));
  assert.deepEqual(prep.findPrepForSession(afterRestart.campaigns[1], afterRestart.campaigns[1].sessions[0]), applied);
});

test("global template edits from another campaign invalidate a saved review across restart without discarding its writing", async t => {
  const { directory, store } = await temporaryStore(t);
  const state = workspaceState(), target = state.campaigns[0];
  workflow.ensureWorkflow(target);
  const targetPrep = prep.ensurePrep(target, target.sessions[0]);
  const library = templates.ensureLibrary(state), original = customTemplate();
  templates.saveTemplate(library, original);
  const review = templates.buildReview(target, target.sessions[0], original);
  review.rows.find(row => row.collection === "scenes").after.title = "Session writing that must survive";
  targetPrep.templateReview = review;
  await store.initializeWorkspace({ state });
  state.activeCampaignId = "second";
  templates.saveTemplate(library, { ...original, openingPrompt: "Updated shared-library guidance." });
  templates.saveTemplate(library, { ...library.templates[original.id], durationMinutes: 240 });
  await store.saveState(state);
  const restored = (await createWorkspaceStore({ directory, appVersion: "1.8.1" }).loadWorkspace()).state;
  const current = templates.ensureLibrary(restored).templates[original.id];
  const restoredTarget = restored.campaigns[0];
  workflow.ensureWorkflow(restoredTarget);
  const savedPrep = prep.findPrepForSession(restoredTarget, restoredTarget.sessions[0]);
  const before = structuredClone(restored);
  assert.deepEqual(savedPrep.templateReview, review);
  assert.equal(templates.validateReview(restoredTarget, restoredTarget.sessions[0], current, savedPrep.templateReview).valid, false);
  assert.throws(() => templates.applyReview(restoredTarget, restoredTarget.sessions[0], current, savedPrep.templateReview), /source template changed/i);
  assert.deepEqual(restored, before);
  assert.equal(savedPrep.scenes.length, 0);
  const refreshed = templates.buildReview(restoredTarget, restoredTarget.sessions[0], current);
  savedPrep.templateReview = refreshed;
  templates.applyReview(restoredTarget, restoredTarget.sessions[0], current, refreshed);
  const applied = structuredClone(restored);
  assert.throws(() => templates.applyReview(restoredTarget, restoredTarget.sessions[0], current, refreshed), /changed|no longer saved/i);
  assert.deepEqual(restored, applied);
});
