const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { createWorkspaceStore } = require("../electron/workspace-store.cjs");

function state(title) {
  return {
    activeCampaignId: "campaign-1",
    campaigns: [{ id: "campaign-1", title }]
  };
}

async function temporaryStore(t, now = () => new Date("2026-06-27T12:00:00.000Z")) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "campaign-engine-test-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  return {
    directory,
    store: createWorkspaceStore({
      directory,
      appVersion: "9.9.9",
      now
    })
  };
}

test("initializes a private workspace and preserves Archivist details on saves", async t => {
  const { store } = await temporaryStore(t);
  await store.initializeWorkspace({
    state: state("First title"),
    archivist: { importedAt: "2026-06-27", campaigns: { "campaign-1": { sessions: {} } } }
  });

  await store.saveState(state("Changed title"));
  const workspace = await store.loadWorkspace();

  assert.equal(workspace.state.campaigns[0].title, "Changed title");
  assert.equal(workspace.archivist.importedAt, "2026-06-27");
  assert.equal(workspace.schemaVersion, 1);
  assert.equal(workspace.appVersion, "9.9.9");
});

test("persists versioned live-session and reconciliation state in backups", async t => {
  const { store } = await temporaryStore(t);
  const sessionWorkflow = {
    schemaVersion: 1,
    desks: { "desk-1": { id: "desk-1", status: "active", scratch: "Door opened" } },
    reconciliations: { "draft-1": { id: "draft-1", deskId: "desk-1", status: "draft", proposals: [] } }
  };
  await store.initializeWorkspace({ state: { campaigns: [{ id: "campaign-1", sessionWorkflow }] } });
  await store.saveState({ campaigns: [{ id: "campaign-1", sessionWorkflow }] });
  const backupPath = await store.createSafetyBackup("session-test");
  const backup = JSON.parse(await fs.readFile(backupPath, "utf8"));
  assert.equal(backup.state.campaigns[0].sessionWorkflow.desks["desk-1"].scratch, "Door opened");
  assert.equal(backup.state.campaigns[0].sessionWorkflow.reconciliations["draft-1"].status, "draft");
});

test("schema 2 preparation and live progress survive desktop save, export, import, and reopen", async t => {
  const { directory, store } = await temporaryStore(t);
  const prepCore = require("../session-prep.js");
  const workflow = require("../session-workflow.js");
  const campaign = {
    id: "campaign-1", title: "The Ash March",
    sessions: [{ localId: "session-1", title: "The Crossing", number: 4, upcoming: true }],
    characters: [{ localId: "guard-1", name: "Vale", description: "The keeper of the gate" }]
  };
  workflow.ensureWorkflow(campaign);
  const prep = prepCore.ensurePrep(campaign, campaign.sessions[0]);
  Object.assign(prep, {
    opening: "The river bell rings.", durationMinutes: 120,
    scenes: [{ id: "scene-1", title: "A bargain at the gate", kind: "social", minutes: 40, detail: "Vale needs a favor.", question: "Offer the relic or find another crossing?" }],
    pinned: [{ type: "character", name: "Vale", localId: "guard-1" }],
    revelations: [{ id: "clue-1", text: "The ferryman is missing.", checked: false }],
    clocks: [{ id: "clock-1", label: "Rising water", max: 6, value: 1 }],
    spotlights: [{ id: "spotlight-1", character: "Mira", opportunity: "Read the flood marks." }],
    tasks: [{ id: "task-1", text: "Prepare the gate map", done: true }]
  });
  await store.initializeWorkspace({ state: { activeCampaignId: campaign.id, campaigns: [campaign] }, archivist: {} });
  const desk = workflow.startDesk(campaign, campaign.sessions[0], "2026-09-20T18:00:00.000Z");
  desk.beats[0].done = true;
  desk.revelations[0].checked = true;
  desk.clocks[0].value = 4;
  desk.scratch = "The party keeps the relic.";
  desk.log.push({ id: "log-1", at: "2026-09-20T18:15:00.000Z", text: "Vale offered a second crossing." });
  prep.scenes[0].detail = "A separate preparation edit made during play.";
  prep.tasks.push({ id: "blank-task", text: "", done: false });
  const expected = structuredClone(campaign);
  await store.saveState({ activeCampaignId: campaign.id, campaigns: [campaign] });

  const reopenedSource = createWorkspaceStore({ directory, appVersion: "9.9.10" });
  const saved = (await reopenedSource.loadWorkspace()).state.campaigns[0];
  assert.deepEqual(saved, expected);
  const exportPath = path.join(directory, "session-prep-backup.json");
  await reopenedSource.exportWorkspace(exportPath);

  const importedDirectory = path.join(directory, "restored-installation");
  const destination = createWorkspaceStore({ directory: importedDirectory, appVersion: "9.9.11" });
  await destination.initializeWorkspace({ state: state("Before restore"), archivist: {} });
  await destination.importWorkspace(exportPath);
  assert((await fs.readdir(destination.backupDirectory)).some(name => name.includes("before-import")));
  const reopenedDestination = createWorkspaceStore({ directory: importedDirectory, appVersion: "9.9.12" });
  const restored = (await reopenedDestination.loadWorkspace()).state.campaigns[0];
  restored.sessionWorkflow = workflow.normalizeWorkflow(restored.sessionWorkflow);
  assert.equal(restored.sessionWorkflow.schemaVersion, 2);
  assert.equal(restored.sessions[0].localId, "session-1");
  assert.deepEqual(prepCore.findPrepForSession(restored, restored.sessions[0]), expected.sessionWorkflow.preps[prep.id]);
  assert.deepEqual(workflow.startDesk(restored, restored.sessions[0]), expected.sessionWorkflow.desks[desk.id]);
  assert.equal(restored.sessionWorkflow.desks[desk.id].beats[0].detail, "Vale needs a favor.");
  assert.deepEqual(restored, expected);
});

test("imports legacy state files and creates a pre-import safety backup", async t => {
  const { directory, store } = await temporaryStore(t);
  await store.initializeWorkspace({ state: state("Before import"), archivist: {} });
  const incomingPath = path.join(directory, "incoming.json");
  await fs.writeFile(incomingPath, JSON.stringify(state("After import")), "utf8");

  const imported = await store.importWorkspace(incomingPath);
  const backups = await fs.readdir(store.backupDirectory);

  assert.equal(imported.state.campaigns[0].title, "After import");
  assert.equal(backups.length, 1);
  assert.match(backups[0], /before-import/);
});

test("separate player packet drafts and approvals survive desktop restore with live source checks", async t => {
  const { directory, store } = await temporaryStore(t);
  const packets = require("../player-packet.js"), workflow = require("../session-workflow.js"), prep = require("../session-prep.js");
  const campaign = { id: "packet-campaign", title: "GM campaign", sessions: [{ localId: "session-1", title: "The private plan", number: 8 }], journal: [{ localId: "letter-1", title: "A letter", body: "Meet at the gate.", knowledge: "players" }] };
  workflow.ensureWorkflow(campaign);
  const draft = packets.createPacket(campaign, campaign.sessions[0], { title: "Working briefing" });
  draft.sections.push(packets.createManualSection({ heading: "Draft", body: "GM edits still pending." }));
  const ready = packets.createPacket(campaign, campaign.sessions[0], { title: "A message for the party" });
  ready.sections.push(packets.createSourceSection(campaign, { type: "journal", localId: "letter-1" }));
  ready.sections[0].body = "Come to the western gate at dusk.";
  campaign.sessionWorkflow.playerPackets[ready.id] = packets.approvePacket(campaign, ready, packets.previewPacket(campaign, ready).fingerprint);
  const expected = structuredClone(campaign), html = packets.exportHTML(campaign, campaign.sessionWorkflow.playerPackets[ready.id]);
  await store.initializeWorkspace({ state: { campaigns: [campaign], activeCampaignId: campaign.id }, archivist: {} });
  await store.saveState({ campaigns: [campaign], activeCampaignId: campaign.id });
  const exported = path.join(directory, "packet-backup.json");
  await store.exportWorkspace(exported);
  const destinationDirectory = path.join(directory, "restored-packets");
  const destination = createWorkspaceStore({ directory: destinationDirectory, appVersion: "1.7.0" });
  await destination.importWorkspace(exported);
  const reopened = createWorkspaceStore({ directory: destinationDirectory, appVersion: "1.7.0" });
  const restored = (await reopened.loadWorkspace()).state.campaigns[0];
  workflow.ensureWorkflow(restored);
  assert.deepEqual(restored, expected);
  assert.equal(packets.exportHTML(restored, packets.findPacket(restored, restored.sessions[0], ready.id)), html);
  assert.equal(packets.validatePacket(restored, packets.findPacket(restored, restored.sessions[0], draft.id)).approved, false);
  restored.sessions[0].title = "Renamed plan";
  prep.ensureSessionReferences(restored, restored.sessions[0]);
  assert.equal(packets.packetsForSession(restored, restored.sessions[0]).length, 2);
  assert.equal(packets.exportHTML(restored, packets.findPacket(restored, restored.sessions[0], ready.id)), html);
  restored.journal[0].knowledge = "gm";
  assert.throws(() => packets.exportHTML(restored, packets.findPacket(restored, restored.sessions[0], ready.id)), /no longer shared/);
  assert.equal(packets.findPacket(restored, restored.sessions[0], draft.id).sections[0].body, "GM edits still pending.");
});

test("a saved continuity review survives desktop export and restore and still applies the selected edit", async t => {
  const { directory, store } = await temporaryStore(t);
  const prep = require("../session-prep.js"), workflow = require("../session-workflow.js"), continuity = require("../prep-continuity.js");
  const campaign = { id: "continuing-campaign", title: "The River", sessions: [{ localId: "next", title: "The Tower", number: 2, upcoming: true }, { localId: "previous", title: "The Gate", number: 1, upcoming: false }], characters: [], quests: [], arcs: [] };
  workflow.ensureWorkflow(campaign);
  const sourcePrep = prep.ensurePrep(campaign, campaign.sessions[1]);
  sourcePrep.scenes.push({ id: "unused", title: "The locked archive", kind: "exploration", minutes: 30, detail: "A chest waits below the stairs.", question: "Will the party enter?" });
  const sourceDesk = workflow.startDesk(campaign, campaign.sessions[1]);
  workflow.endDesk(campaign, sourceDesk.id);
  const targetPrep = prep.ensurePrep(campaign, campaign.sessions[0]);
  const review = continuity.buildReview(campaign, campaign.sessions[0]);
  review.candidates[0].selected = true;
  review.candidates[0].after.detail = "The chest is rising with the flood.";
  targetPrep.continuityReview = review;
  const originalDesk = structuredClone(sourceDesk);
  await store.initializeWorkspace({ state: { activeCampaignId: campaign.id, campaigns: [campaign] } });
  const exportPath = path.join(directory, "continuity-backup.json");
  await store.exportWorkspace(exportPath);
  const destination = createWorkspaceStore({ directory: path.join(directory, "continuity-restore"), appVersion: "9.9.10" });
  await destination.importWorkspace(exportPath);
  const restored = (await destination.loadWorkspace()).state.campaigns[0];
  restored.sessionWorkflow = workflow.normalizeWorkflow(restored.sessionWorkflow);
  const restoredReview = prep.findPrepForSession(restored, restored.sessions[0]).continuityReview;
  assert.deepEqual(restoredReview, review);
  assert.equal(continuity.validateReview(restored, restored.sessions[0], restoredReview).valid, true);
  const selection = restoredReview.candidates.find(candidate => candidate.selected);
  const result = continuity.applyReview(restored, restored.sessions[0], restoredReview, [{ id: selection.id, accepted: true, after: selection.after }]);
  const carried = prep.findPrepForSession(result.campaign, result.campaign.sessions[0]).scenes[0];
  assert.equal(carried.detail, "The chest is rising with the flood.");
  assert.deepEqual(carried.provenance, selection.provenance);
  assert.deepEqual(result.campaign.sessionWorkflow.desks[sourceDesk.id], originalDesk);
});

test("replaces the demo workspace with a safety backup", async t => {
  const { store } = await temporaryStore(t);
  await store.initializeWorkspace({ state: state("Sample campaign"), archivist: {} });

  const replaced = await store.replaceWorkspace({
    state: state("Archivist campaign"),
    archivist: { importedAt: "2026-06-28", campaigns: {} }
  }, "before-archivist");
  const backups = await fs.readdir(store.backupDirectory);

  assert.equal(replaced.state.campaigns[0].title, "Archivist campaign");
  assert.equal(backups.length, 1);
  assert.match(backups[0], /before-archivist/);
});

test("recovers the previous valid workspace when the primary file is damaged", async t => {
  const { store } = await temporaryStore(t);
  await store.initializeWorkspace({ state: state("Recover me"), archivist: {} });
  await store.saveState(state("Newest title"));
  await fs.writeFile(store.workspacePath, "{not valid json", "utf8");

  const recovered = await store.loadWorkspace();

  assert.equal(recovered.state.campaigns[0].title, "Recover me");
  assert.equal(recovered.recoveredFromPrevious, true);
});

test("rejects files without campaign records", async t => {
  const { directory, store } = await temporaryStore(t);
  const invalidPath = path.join(directory, "invalid.json");
  await fs.writeFile(invalidPath, JSON.stringify({ hello: "world" }), "utf8");

  await assert.rejects(() => store.importWorkspace(invalidPath), /valid Campaign Engine workspace/);
});

test("a future primary schema blocks load and writes without replacing either workspace file", async t => {
  const { directory, store } = await temporaryStore(t);
  await store.initializeWorkspace({ state: state("Previous supported workspace") });
  await store.saveState(state("Latest supported workspace"));
  const previousPath = path.join(directory, "campaign-engine-workspace.previous.json");
  const previousBytes = await fs.readFile(previousPath);
  const futureBytes = Buffer.from(JSON.stringify({ schemaVersion: 999, state: state("Future workspace"), futureFeature: { preserve: true } }, null, 3));
  await fs.writeFile(store.workspacePath, futureBytes);
  const supportedImport = path.join(directory, "supported-import.json");
  await fs.writeFile(supportedImport, JSON.stringify({ schemaVersion: 1, state: state("Replacement") }));
  const actions = [
    () => store.loadWorkspace(),
    () => store.saveState(state("Attempted edit")),
    () => store.initializeWorkspace({ state: state("Attempted initialization") }),
    () => store.replaceWorkspace({ state: state("Attempted replacement") }),
    () => store.importWorkspace(supportedImport),
    () => store.createSafetyBackup()
  ];
  for (const action of actions) {
    await assert.rejects(action, { code: "UNSUPPORTED_WORKSPACE_SCHEMA" });
    assert.deepEqual(await fs.readFile(store.workspacePath), futureBytes);
    assert.deepEqual(await fs.readFile(previousPath), previousBytes);
  }
  assert.deepEqual(await fs.readdir(store.backupDirectory), []);
  assert.equal((await fs.readdir(directory)).some(name => name.includes(".corrupt-") || name.endsWith(".tmp")), false);
});

test("future imports and replacements preserve the source and current workspace bytes", async t => {
  const { directory, store } = await temporaryStore(t);
  await store.initializeWorkspace({ state: state("Before rejected import") });
  await store.saveState(state("Current supported data"));
  const original = await fs.readFile(store.workspacePath);
  const previousPath = path.join(directory, "campaign-engine-workspace.previous.json");
  const previous = await fs.readFile(previousPath);
  const incoming = { schemaVersion: 999, state: state("Needs a newer app"), archivist: { campaigns: {} } };
  const incomingPath = path.join(directory, "future-import.json");
  const incomingBytes = Buffer.from(JSON.stringify(incoming, null, 4) + "\n");
  await fs.writeFile(incomingPath, incomingBytes);

  await assert.rejects(() => store.importWorkspace(incomingPath), { code: "UNSUPPORTED_WORKSPACE_SCHEMA" });
  await assert.rejects(() => store.replaceWorkspace(incoming), /requires a newer Campaign Engine/);
  assert.deepEqual(await fs.readFile(incomingPath), incomingBytes);
  assert.deepEqual(await fs.readFile(store.workspacePath), original);
  assert.deepEqual(await fs.readFile(previousPath), previous);
  assert.deepEqual(await fs.readdir(store.backupDirectory), []);
});

test("a future previous file cannot be downgraded during corrupt-primary recovery", async t => {
  const { directory, store } = await temporaryStore(t);
  await store.initializeWorkspace({ state: state("Supported") });
  const damaged = Buffer.from("{broken primary");
  const previous = Buffer.from(JSON.stringify({ schemaVersion: 2, state: state("Future previous data") }));
  const previousPath = path.join(directory, "campaign-engine-workspace.previous.json");
  await fs.writeFile(store.workspacePath, damaged);
  await fs.writeFile(previousPath, previous);
  await assert.rejects(() => store.loadWorkspace(), { code: "UNSUPPORTED_WORKSPACE_SCHEMA" });
  assert.deepEqual(await fs.readFile(store.workspacePath), damaged);
  assert.deepEqual(await fs.readFile(previousPath), previous);
});

test("save, import, and replace preserve a future previous file beside a supported primary", async t => {
  const { directory, store } = await temporaryStore(t);
  await store.initializeWorkspace({ state: state("Supported primary") });
  const primaryBytes = await fs.readFile(store.workspacePath);
  const previousPath = path.join(directory, "campaign-engine-workspace.previous.json");
  const previousBytes = Buffer.from(JSON.stringify({ schemaVersion: 999, state: state("Future previous workspace"), futureOnlyData: { notes: ["Preserve these original bytes"] } }, null, 4) + "\n");
  await fs.writeFile(previousPath, previousBytes);
  const incomingPath = path.join(directory, "supported-incoming.json");
  const incomingBytes = Buffer.from(JSON.stringify({ schemaVersion: 1, state: state("Supported replacement") }));
  await fs.writeFile(incomingPath, incomingBytes);

  assert.equal((await store.loadWorkspace()).state.campaigns[0].title, "Supported primary");
  const actions = [
    () => store.saveState(state("Attempted save")),
    () => store.importWorkspace(incomingPath),
    () => store.replaceWorkspace({ state: state("Attempted replacement") })
  ];
  for (const action of actions) {
    await assert.rejects(action, error => {
      assert.equal(error.code, "UNSUPPORTED_WORKSPACE_SCHEMA");
      assert.match(error.message, /previous workspace backup/i);
      assert.match(error.message, /safe location|compatible|newer/i);
      return true;
    });
    assert.deepEqual(await fs.readFile(store.workspacePath), primaryBytes);
    assert.deepEqual(await fs.readFile(previousPath), previousBytes);
    assert.deepEqual(await fs.readFile(incomingPath), incomingBytes);
  }
  assert.deepEqual(await fs.readdir(store.backupDirectory), []);
  assert.equal((await fs.readdir(directory)).some(name => name.endsWith(".tmp")), false);
});

test("legacy and current workspace formats round-trip without changing nested campaign data", async t => {
  const { directory } = await temporaryStore(t);
  const expectedState = state("Persistent campaign");
  expectedState.campaigns[0].sessionWorkflow = { schemaVersion: 2, preps: { plan: { id: "plan", opening: "Keep this plan" } } };
  const archivist = { importedAt: "2026-06-01", campaigns: { "campaign-1": { notes: ["Original detail"] } } };
  const fixtures = [
    { name: "bare-legacy", value: expectedState, details: {} },
    { name: "unversioned", value: { state: expectedState, archivist }, details: archivist },
    { name: "version-zero", value: { schemaVersion: 0, state: expectedState, archivist }, details: archivist },
    { name: "version-one", value: { schemaVersion: 1, state: expectedState, archivist }, details: archivist }
  ];
  for (const fixture of fixtures) {
    const incomingPath = path.join(directory, `${fixture.name}.json`);
    await fs.writeFile(incomingPath, JSON.stringify(fixture.value));
    const destinationDirectory = path.join(directory, fixture.name);
    const destination = createWorkspaceStore({ directory: destinationDirectory, appVersion: "9.9.9" });
    await destination.importWorkspace(incomingPath);
    await destination.saveState(expectedState);
    const exportedPath = path.join(directory, `${fixture.name}-export.json`);
    await destination.exportWorkspace(exportedPath);
    const exported = JSON.parse(await fs.readFile(exportedPath, "utf8"));
    assert.equal(exported.schemaVersion, 1);
    assert.deepEqual(exported.state, expectedState, fixture.name);
    assert.deepEqual(exported.archivist, fixture.details, fixture.name);
    const reopened = createWorkspaceStore({ directory: destinationDirectory, appVersion: "10.0.0" });
    assert.deepEqual((await reopened.loadWorkspace()).state, expectedState, fixture.name);
  }
});

test("backup retention keeps the twelve newest creation times across different reasons", async t => {
  let current = new Date("2026-06-01T00:00:00.000Z");
  const { store } = await temporaryStore(t, () => current);
  await store.initializeWorkspace({ state: state("The workspace edit time stays unchanged") });
  const created = [];
  for (let index = 0; index < 14; index++) {
    current = new Date(Date.UTC(2026, 5, index + 2));
    const reason = index % 2 ? "before-import" : "manual";
    const backupPath = await store.createSafetyBackup(reason);
    const saved = JSON.parse(await fs.readFile(backupPath, "utf8"));
    assert.equal(saved.backupCreatedAt, current.toISOString());
    assert.equal(saved.savedAt, "2026-06-01T00:00:00.000Z");
    // Retention must follow stored creation time even if filesystem times disagree.
    await fs.utimes(backupPath, new Date("2030-01-01"), new Date("2030-01-01"));
    created.push(path.basename(backupPath));
  }
  assert.deepEqual((await fs.readdir(store.backupDirectory)).sort(), created.slice(-12).sort());
});

test("legacy backup chronology is recovered across reason prefixes and unsafe-to-prune files are retained", async t => {
  const { store } = await temporaryStore(t, () => new Date("2026-06-20T00:00:00.000Z"));
  await store.initializeWorkspace({ state: state("Current campaign") });
  const protectedFiles = {
    "campaign-engine-damaged-2020-01-01T00-00-00-000Z.json": "{damaged",
    "campaign-engine-future-2020-01-01T00-00-00-000Z.json": JSON.stringify({ schemaVersion: 999, state: state("Future backup") }),
    "personal-copy.json": JSON.stringify({ schemaVersion: 1, state: state("Personal copy") })
  };
  for (const [name, content] of Object.entries(protectedFiles)) await fs.writeFile(path.join(store.backupDirectory, name), content);
  const legacyNames = [];
  for (let index = 0; index < 13; index++) {
    const day = String(index + 1).padStart(2, "0");
    const reason = index < 2 ? "zz-old-manual" : "aa-before-import";
    const name = `campaign-engine-${reason}-2026-06-${day}T00-00-00-000Z.json`;
    const backupPath = path.join(store.backupDirectory, name);
    await fs.writeFile(backupPath, JSON.stringify({ schemaVersion: 1, savedAt: "2026-01-01T00:00:00.000Z", state: state(`Legacy ${index}`) }));
    await fs.utimes(backupPath, new Date("2030-01-01"), new Date("2030-01-01"));
    legacyNames.push(name);
  }
  const latest = await store.createSafetyBackup("before-session-reconciliation");
  const expected = [...Object.keys(protectedFiles), ...legacyNames.slice(2), path.basename(latest)].sort();
  assert.deepEqual((await fs.readdir(store.backupDirectory)).sort(), expected);
  for (const [name, content] of Object.entries(protectedFiles)) assert.equal(await fs.readFile(path.join(store.backupDirectory, name), "utf8"), content);
});

test("same-timestamp backups never overwrite an earlier snapshot", async t => {
  const { store } = await temporaryStore(t);
  await store.initializeWorkspace({ state: state("First snapshot") });
  const firstPath = await store.createSafetyBackup("manual");
  const firstBytes = await fs.readFile(firstPath);
  await store.saveState(state("Second snapshot"));
  const secondPath = await store.createSafetyBackup("manual");
  const concurrent = await Promise.all([store.createSafetyBackup("manual"), store.createSafetyBackup("manual")]);
  assert.equal(new Set([firstPath, secondPath, ...concurrent]).size, 4);
  assert.deepEqual(await fs.readFile(firstPath), firstBytes);
  assert.equal(JSON.parse(await fs.readFile(secondPath, "utf8")).state.campaigns[0].title, "Second snapshot");
  assert.equal((await fs.readdir(store.backupDirectory)).length, 4);
});
