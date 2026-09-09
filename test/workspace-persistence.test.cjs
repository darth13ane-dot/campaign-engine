const test = require("node:test");
const assert = require("node:assert/strict");
const { initialState, createSaveController } = require("../workspace-persistence.js");
const { createWorkspaceCloseGuard } = require("../electron/workspace-close.cjs");

test("restores manual browser campaigns with an empty or populated bundled snapshot", () => {
  const saved = { campaigns: [{ id: "user" }] }, seed = { campaigns: [{ id: "sample" }] };
  for (const snapshot of [[], [{ id: "import" }], null]) assert.equal(initialState(saved, snapshot, seed), saved);
  assert.equal(initialState({ campaigns: [] }, [], seed).campaigns[0].id, "sample");
});
test("campaign fallback preserves a workspace template library including an unsupported future version", () => {
  for (const schemaVersion of [1, 99]) {
    const saved = { campaigns: [], prepTemplates: { schemaVersion, templates: { custom: { id: "custom", name: "My session shape" } } } };
    const before = structuredClone(saved);
    for (const snapshot of [[], [{ id: "imported-campaign" }]]) {
      const restored = initialState(saved, snapshot, { campaigns: [{ id: "example" }] });
      assert.deepEqual(restored.prepTemplates, before.prepTemplates);
      restored.prepTemplates.templates.custom.name = "A separate edit";
      assert.deepEqual(saved, before);
    }
  }
});

test("coalesces typing before cloning and writes the latest state", async () => {
  let text = "", clones = 0; const writes = [];
  const saver = createSaveController({ snapshot: () => { clones++; return { text }; }, write: value => writes.push(value), delay: 10000 });
  for (let i = 0; i < 30; i++) { text += "x"; saver.request(); }
  assert.equal(clones, 0);
  await saver.flush();
  assert.equal(clones, 1); assert.equal(writes.length, 1); assert.equal(writes[0].text, text); assert.equal(saver.dirty, false);
});
test("serializes an edit arriving during a slow save without losing the final state", async () => {
  const writes = []; let text = "first", finish;
  const saver = createSaveController({ snapshot: () => text, write: value => { writes.push(value); return writes.length === 1 ? new Promise(resolve => { finish = resolve; }) : undefined; } });
  saver.request(); const first = saver.flush();
  text = "last"; saver.request(); const second = saver.flush(); finish();
  await Promise.all([first, second]); assert.deepEqual(writes, ["first", "last"]); assert.equal(saver.dirty, false);
});
test("failed writes remain dirty and reject flush until a successful retry", async () => {
  let fail = true; const states = [];
  const saver = createSaveController({ snapshot: () => "latest", write: () => { if (fail) throw new Error("disk full"); }, onStatus: value => states.push(value.status) });
  saver.request(); await assert.rejects(saver.flush(), /disk full/); assert.equal(saver.dirty, true); assert.equal(states.at(-1), "error");
  fail = false; await saver.flush(); assert.equal(saver.dirty, false);
});
test("desktop close waits for saving and stays open after a failure", async () => {
  let requests = 0, closes = 0, prevented = 0;
  const guard = createWorkspaceCloseGuard({ requestFlush: () => requests++, close: () => closes++, reportError: async () => false });
  guard.setDirty(true); guard.onClose({ preventDefault: () => prevented++ }); guard.onClose({ preventDefault: () => prevented++ });
  assert.equal(requests, 1); assert.equal(prevented, 2); assert.equal(closes, 0);
  await guard.finish({ ok: false }); assert.equal(closes, 0);
  guard.onClose({ preventDefault: () => prevented++ }); await guard.finish({ ok: true }); assert.equal(closes, 1);
});
