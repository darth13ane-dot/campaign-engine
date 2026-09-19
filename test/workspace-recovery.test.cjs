const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const vm = require("node:vm");
const { createWorkspaceStore } = require("../electron/workspace-store.cjs");
async function fixture(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "campaign-recovery-test-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  return { directory, store: createWorkspaceStore({ directory, appVersion: "1.9.0" }) };
}
const workspace = title => ({ state: { campaigns: [{ id: "campaign", title, sessions: [{ localId: "session", title: "Next" }] }] } });

test("desktop startup keeps edited example campaigns when a bundled import is available", async () => {
  const source = await fs.readFile(path.join(__dirname, "../app.js"), "utf8");
  const start = source.indexOf("async function initializeDesktopWorkspace()"), end = source.indexOf("\nfunction activeCampaign()", start);
  assert(start > 0 && end > start);
  const saved = { state: { activeCampaignId: "vey", campaigns: [{ id: "vey", title: "My edited example", sessions: [{ title: "My session" }] }, { id: "gut", title: "My second edited campaign" }] } };
  let applied, replacements = 0;
  const context = vm.createContext({
    ARCHIVIST_SNAPSHOT: [{ id: "incoming", title: "Bundled import" }], workspaceLoadError: null, workspaceLoadErrorCode: null, desktopWorkspaceInfo: {},
    DESKTOP_API: { loadWorkspace: async () => ({ workspace: saved, info: { mode: "desktop" } }), replaceWorkspace: async () => { replacements++; } },
    workspacePayload: () => ({ state: { campaigns: [{ id: "incoming" }] } }),
    applyWorkspace: value => { applied = value; }, showToast() {}, render() {}
  });
  vm.runInContext(source.slice(start, end), context);
  await context.initializeDesktopWorkspace();
  assert.equal(replacements, 0);
  assert.deepEqual(applied, saved);
});

test("empty desktop workspaces retain their library through save, backup, and restore", async t => {
  const { store, directory } = await fixture(t);
  const empty = { campaigns: [], activeCampaignId: null, prepTemplates: { schemaVersion: 1, templates: { personal: { id: "personal", name: "My structure" } } } };
  await store.initializeWorkspace({ state: empty });
  await store.saveState(empty);
  const backup = path.join(directory, "empty-export.json");
  await store.exportWorkspace(backup);
  await store.replaceWorkspace(workspace("Temporary campaign"));
  await store.importWorkspace(backup);
  assert.deepEqual((await store.loadWorkspace()).state, empty);
});

test("recovery lists supported and damaged copies without changing files, and only reads scoped files", async t => {
  const { store, directory } = await fixture(t);
  await store.initializeWorkspace(workspace("Original"));
  const backup = await store.createSafetyBackup("manual");
  await store.saveState(workspace("Edited").state);
  const damaged = path.join(store.backupDirectory, "campaign-engine-broken.json");
  await fs.writeFile(damaged, "{broken");
  const originals = new Map(await Promise.all([backup, damaged, store.workspacePath].map(async name => [name, await fs.readFile(name)])));
  const copies = await store.listWorkspaceBackups();
  assert(copies.some(copy => copy.id === "previous" && copy.summary.campaigns[0].title === "Original"));
  assert(copies.some(copy => copy.id === path.basename(backup) && copy.summary.campaigns[0].title === "Original"));
  assert(copies.some(copy => copy.id === path.basename(damaged) && copy.error && !copy.summary));
  assert.equal((await store.readWorkspaceBackup(path.basename(backup))).state.campaigns[0].title, "Original");
  for (const bad of ["../campaign-engine-workspace.json", store.workspacePath, "..\\campaign-engine-workspace.json", "other.json"]) await assert.rejects(store.readWorkspaceBackup(bad), /listed/);
  for (const [name, bytes] of originals) assert.deepEqual(await fs.readFile(name), bytes);
  assert.equal((await fs.readdir(directory)).filter(name => name.includes("corrupt")).length, 0);
});

test("reviewed recovery preserves both damaged originals byte-for-byte before replacement", async t => {
  const { store, directory } = await fixture(t);
  await store.initializeWorkspace(workspace("Original"));
  const previous = path.join(directory, "campaign-engine-workspace.previous.json");
  const primaryBytes = Buffer.from("{damaged primary\n"), previousBytes = Buffer.from('{"state":{"campaigns":[null]}}');
  await fs.writeFile(store.workspacePath, primaryBytes); await fs.writeFile(previous, previousBytes);
  await assert.rejects(store.loadWorkspace());
  await store.replaceWorkspace(workspace("Recovered"), "reviewed-restore");
  assert.equal((await store.loadWorkspace()).state.campaigns[0].title, "Recovered");
  const copies = await fs.readdir(store.backupDirectory);
  assert.deepEqual(await fs.readFile(path.join(store.backupDirectory, copies.find(name => name.includes("preserved-primary")))), primaryBytes);
  assert.deepEqual(await fs.readFile(path.join(store.backupDirectory, copies.find(name => name.includes("preserved-previous")))), previousBytes);
});

test("reviewed recovery cannot overwrite future schemas or bypass a backup I/O failure", async t => {
  const { store, directory } = await fixture(t);
  await store.initializeWorkspace(workspace("Original"));
  const future = Buffer.from(JSON.stringify({ ...workspace("Future"), schemaVersion: 99 }));
  await fs.writeFile(store.workspacePath, future);
  await assert.rejects(store.replaceWorkspace(workspace("Replacement"), "reviewed-restore"), { code: "UNSUPPORTED_WORKSPACE_SCHEMA" });
  assert.deepEqual(await fs.readFile(store.workspacePath), future);
  await fs.writeFile(store.workspacePath, "{damaged");
  const backupPath = path.resolve(store.backupDirectory);
  assert.equal(path.dirname(backupPath), path.resolve(directory));
  await fs.rmdir(backupPath); await fs.writeFile(backupPath, "directory blocked");
  await assert.rejects(store.replaceWorkspace(workspace("Replacement"), "reviewed-restore"));
  assert.equal(await fs.readFile(store.workspacePath, "utf8"), "{damaged");
});

test("invalid imports preserve current, previous, and incoming bytes", async t => {
  const { store, directory } = await fixture(t);
  await store.initializeWorkspace(workspace("Original")); await store.saveState(workspace("Edited").state);
  const previous = path.join(directory, "campaign-engine-workspace.previous.json");
  const primaryBefore = await fs.readFile(store.workspacePath), previousBefore = await fs.readFile(previous);
  for (const bad of [{ campaigns: [{}] }, { campaigns: [{ id: "same" }, { id: "same" }] }, { campaigns: [{ id: "bad", sessionWorkflow: { preps: { prep: { scenes: [null] } } } }] }]) {
    const source = path.join(directory, "invalid-import.json"), original = Buffer.from(JSON.stringify(bad));
    await fs.writeFile(source, original);
    await assert.rejects(store.importWorkspace(source), { code: "INVALID_WORKSPACE_DATA" });
    assert.deepEqual(await fs.readFile(source), original);
    assert.deepEqual(await fs.readFile(store.workspacePath), primaryBefore);
    assert.deepEqual(await fs.readFile(previous), previousBefore);
  }
});
