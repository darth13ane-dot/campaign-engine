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

async function temporaryStore(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "campaign-engine-test-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  return {
    directory,
    store: createWorkspaceStore({
      directory,
      appVersion: "9.9.9",
      now: () => new Date("2026-06-27T12:00:00.000Z")
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
