const test = require("node:test"), assert = require("node:assert/strict");
const { IDBFactory, IDBObjectStore } = require("fake-indexeddb");
const browser = require("../browser-workspace-store.js");
const schema = require("../workspace-schema.js");
const workspace = title => ({ schemaVersion: 1, state: { activeCampaignId: "campaign", campaigns: [{ id: "campaign", title, sessions: [{ localId: "session", title: "Next" }] }], prepTemplates: { schemaVersion: 1, templates: { custom: { id: "custom", name: "Personal structure" } } } }, archivist: { campaigns: { original: { content: "Imported details" } } } });
function fixture(t, primary = null, previous = null) {
  const indexedDB = new IDBFactory(), data = new Map();
  if (primary != null) data.set(browser.PRIMARY, primary);
  if (previous != null) data.set(browser.RECOVERY, previous);
  const legacyStorage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)) };
  const stores = [];
  const create = options => { const store = browser.createStore({ indexedDB, legacyStorage, ...options }); stores.push(store); return store; };
  t.after(() => stores.forEach(store => store.close()));
  return { indexedDB, legacyStorage, data, create, store: create() };
}
async function editRecord(factory, edit) {
  const db = await new Promise((resolve, reject) => { const req = factory.open(browser.DATABASE, 1); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction("workspace", "readwrite"), store = tx.objectStore("workspace"); let result;
      const req = store.get("current"); req.onsuccess = () => { result = edit(req.result); if (result === null) store.delete("current"); else store.put(result, "current"); };
      tx.oncomplete = () => resolve(result); tx.onabort = () => reject(tx.error);
    });
  } finally { db.close(); }
}
test("migrates exact legacy copies once, retains empty workspaces and rejects old-app loading of the marker", async t => {
  const value = workspace("Original"); value.state.campaigns = []; value.state.activeCampaignId = null;
  const raw = JSON.stringify(value, null, 2) + "\n", previous = JSON.stringify(workspace("Previous"));
  const { store, create, data } = fixture(t, raw, previous);
  assert.deepEqual((await store.load()).state, value.state);
  assert.equal(await store.readRaw("legacy-primary"), raw); assert.equal(await store.readRaw("legacy-previous"), previous);
  assert.equal((await store.listCopies()).find(copy => copy.id === "legacy-primary").savedAt, undefined, "Legacy copies without a timestamp must not display a fabricated save time");
  assert.equal(data.get(browser.PRIMARY), browser.MARKER); assert.equal(data.get(browser.RECOVERY), browser.MARKER);
  assert.throws(() => schema.normalizeWorkspace(JSON.parse(browser.MARKER)), { code: "UNSUPPORTED_WORKSPACE_SCHEMA" });
  await store.save(workspace("Edited"));
  assert.equal((await create().load()).state.campaigns[0].title, "Edited");
  assert.equal(await store.readRaw("previous"), raw); assert.equal(await store.readRaw("legacy-primary"), raw);
});
test("captures writes before awaiting the database and saves a 24 MB workspace with its previous revision", async t => {
  const { store, create } = fixture(t); assert.equal(await store.load(), null);
  const value = workspace("Large"); value.state.campaigns[0].documents = [{ id: "large", title: "Reference", text: "x".repeat(24 * 1024 * 1024) }];
  const saving = store.save(value); value.state.campaigns[0].title = "Later edit"; await saving;
  assert.equal((await create().load()).state.campaigns[0].title, "Large");
  await store.save(value);
  assert.equal(JSON.parse(await store.readRaw("previous")).state.campaigns[0].title, "Large");
  assert.equal((await create().load()).state.campaigns[0].documents[0].text.length, 24 * 1024 * 1024);
});
test("an aborted write leaves primary, previous, revision and original migration data intact", async t => {
  const raw = JSON.stringify(workspace("Original")), previous = JSON.stringify(workspace("Previous"));
  const { store, indexedDB } = fixture(t, raw, previous); await store.load();
  const revision = store.revision, put = IDBObjectStore.prototype.put;
  let requestSucceeded = false;
  IDBObjectStore.prototype.put = function (...args) { const request = put.apply(this, args); request.addEventListener("success", () => { requestSucceeded = true; this.transaction.abort(); }); return request; };
  try { await assert.rejects(store.replace(workspace("Rejected")), /canceled|abort/i); }
  finally { IDBObjectStore.prototype.put = put; }
  assert.equal(requestSucceeded, true, "A successful put request must not be reported as a committed save");
  assert.equal(await store.readRaw(), raw); assert.equal(await store.readRaw("previous"), previous); assert.equal(store.revision, revision);
  await store.save(workspace("Retry")); assert.equal((await store.load()).state.campaigns[0].title, "Retry");
});
test("migration abort preserves legacy keys and a marker-write interruption resumes without losing originals", async t => {
  const raw = JSON.stringify(workspace("Original")), previous = "{damaged previous";
  const { store, legacyStorage, data } = fixture(t, raw, previous), put = IDBObjectStore.prototype.put;
  IDBObjectStore.prototype.put = function (...args) { const request = put.apply(this, args); this.transaction.abort(); return request; };
  try { await assert.rejects(store.load()); } finally { IDBObjectStore.prototype.put = put; }
  assert.equal(data.get(browser.PRIMARY), raw); assert.equal(data.get(browser.RECOVERY), previous);
  const write = legacyStorage.setItem;
  legacyStorage.setItem = (key, value) => { if (key === browser.RECOVERY) throw new Error("Interrupted marker write"); write(key, value); };
  await assert.rejects(store.load(), /Interrupted marker/);
  assert.equal(data.get(browser.PRIMARY), browser.MARKER); assert.equal(data.get(browser.RECOVERY), previous);
  assert.equal(await store.readRaw("legacy-primary"), raw);
  legacyStorage.setItem = write;
  assert.equal((await store.load()).state.campaigns[0].title, "Original");
  assert.equal(await store.readRaw("legacy-previous"), previous);
});
test("two tabs cannot overwrite a changed workspace and explicit reload permits a fresh edit", async t => {
  const { store, create } = fixture(t, JSON.stringify(workspace("Original"))); await store.load();
  const other = create(); await other.load();
  await store.save(workspace("First tab"));
  await assert.rejects(other.save(workspace("Stale second tab")), { code: "BROWSER_WORKSPACE_CONFLICT" });
  assert.equal(JSON.parse(await other.readRaw()).state.campaigns[0].title, "First tab");
  await other.load(); await other.save(workspace("Reloaded second tab"));
  assert.equal(JSON.parse(await store.readRaw()).state.campaigns[0].title, "Reloaded second tab");
});
test("older-tab writes stop new saves and explicit reopening preserves both branches for review", async t => {
  const original = JSON.stringify(workspace("Original")), older = JSON.stringify(workspace("Older tab edits"));
  const { store, data } = fixture(t, original); await store.load(); await store.save(workspace("New app edits"));
  data.set(browser.PRIMARY, older);
  await assert.rejects(store.save(workspace("Would overwrite")), { code: "BROWSER_WORKSPACE_CONFLICT" });
  await assert.rejects(store.load(), { code: "BROWSER_WORKSPACE_CONFLICT" });
  assert.equal(data.get(browser.PRIMARY), older);
  assert.equal((await store.load({ resolveLegacyConflict: true })).state.campaigns[0].title, "New app edits");
  const copy = (await store.listCopies()).find(copy => /Older app primary/.test(copy.label));
  assert.equal(await store.readRaw(copy.id), older); assert.equal(await store.readRaw("legacy-primary"), original);
});
test("future legacy workspaces stay byte-identical before migration", async t => {
  const future = JSON.stringify({ ...workspace("Future"), schemaVersion: 99 });
  for (const pair of [[future, null], [JSON.stringify(workspace("Current")), future]]) {
    const { store, data } = fixture(t, ...pair);
    await assert.rejects(store.load(), { code: "UNSUPPORTED_WORKSPACE_SCHEMA" });
    assert.equal(data.get(browser.PRIMARY), pair[0]); assert.equal(data.get(browser.RECOVERY) ?? null, pair[1]);
  }
});
test("future current, previous and storage formats reject replacement without changing saved data", async t => {
  for (const field of ["primary", "previous", "storageVersion"]) {
    const { store, indexedDB } = fixture(t, JSON.stringify(workspace("Original"))); await store.load();
    const future = JSON.stringify({ ...workspace("Future"), schemaVersion: 99 });
    let before;
    await editRecord(indexedDB, record => { record[field] = field === "storageVersion" ? 99 : future; before = JSON.stringify(record); return record; });
    await assert.rejects(store.replace(workspace("Rejected"), { allowDamaged: true }), { code: field === "storageVersion" ? "UNSUPPORTED_BROWSER_STORAGE" : "UNSUPPORTED_WORKSPACE_SCHEMA" });
    await editRecord(indexedDB, record => { assert.equal(JSON.stringify(record), before); return record; });
  }
});
test("reviewed recovery preserves damaged primary and previous bytes across subsequent saves", async t => {
  const { store } = fixture(t, "{damaged primary", "{damaged previous");
  await assert.rejects(store.load(), SyntaxError);
  await assert.rejects(store.save(workspace("Unreviewed")), SyntaxError);
  await store.replace(workspace("Recovered"), { allowDamaged: true }); await store.save(workspace("Later edit"));
  const copies = await store.listCopies();
  for (const label of ["primary", "previous"]) {
    const copy = copies.find(copy => copy.label === `Preserved damaged ${label}`);
    assert.equal(await store.readRaw(copy.id), `{damaged ${label}`);
  }
  assert.equal((await store.load()).state.campaigns[0].title, "Later edit");
});
test("missing migrated databases require reviewed recovery instead of silently reverting to an empty workspace", async t => {
  const { store, indexedDB } = fixture(t); await store.load(); await store.save(workspace("Original"));
  await editRecord(indexedDB, () => null);
  await assert.rejects(store.load(), { code: "BROWSER_DATABASE_MISSING" });
  await assert.rejects(store.save(workspace("Unreviewed")), { code: "BROWSER_DATABASE_MISSING" });
  await store.replace(workspace("Recovered backup"), { allowDamaged: true });
  assert.equal((await store.load()).state.campaigns[0].title, "Recovered backup");
});
test("database upgrades close old connections and refuse writes through the old application", async t => {
  const notices = [], { store, indexedDB } = fixture(t); await store.load();
  const observer = browser.createStore({ indexedDB, legacyStorage: { getItem: () => browser.MARKER }, onUnavailable: error => notices.push(error.code) });
  await observer.load(); t.after(() => observer.close());
  const upgraded = await new Promise((resolve, reject) => { const req = indexedDB.open(browser.DATABASE, 2); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
  upgraded.close(); assert.deepEqual(notices, ["BROWSER_STORAGE_CHANGED"]);
  await assert.rejects(store.save(workspace("Old app")), { code: "UNSUPPORTED_BROWSER_STORAGE" });
});
