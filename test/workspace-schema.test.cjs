const test = require("node:test");
const assert = require("node:assert/strict");
const schema = require("../workspace-schema.js");

test("legacy, wrapped, empty, and future-template workspaces retain their contents on validation", () => {
  const state = { campaigns: [], prepTemplates: { schemaVersion: 99, templates: { private: { name: "Unopened future template" } } }, appearance: { theme: "midnight" } };
  const before = structuredClone(state);
  for (const value of [state, { schemaVersion: 0, state }, { schemaVersion: 1, state }]) {
    assert.deepEqual(schema.normalizeWorkspace(value).state, before);
    assert.equal(schema.summary(value).templates, 1);
  }
  assert.deepEqual(state, before);
});

test("invalid identities and nested planning containers are rejected without rewriting their contents", () => {
  const base = { campaigns: [{ id: "campaign", title: "Keep my work", sessions: [], sessionWorkflow: { schemaVersion: 2, preps: {} } }] };
  const mutations = [
    value => delete value.campaigns[0].id,
    value => value.campaigns.push({ id: "campaign" }),
    value => value.campaigns[0].characters = [null],
    value => value.campaigns[0].title = { unsafe: "object" },
    value => value.campaigns[0].sessionWorkflow.preps = [],
    value => value.campaigns[0].sessionWorkflow.preps.plan = { scenes: "malformed" },
    value => value.campaigns[0].sessionWorkflow.playerPackets = { packet: { sections: ["malformed"] } }
  ];
  for (const mutate of mutations) {
    const state = structuredClone(base); mutate(state); const before = structuredClone(state);
    assert.throws(() => schema.normalizeWorkspace({ state }), { code: "INVALID_WORKSPACE_DATA" });
    assert.deepEqual(state, before);
  }
});

test("future workspace and session-workflow schemas require a compatible version", () => {
  for (const value of [{ schemaVersion: 9, state: { campaigns: [] } }, { campaigns: [{ id: "campaign", sessionWorkflow: { schemaVersion: 99, futurePlan: "preserve" } }] }]) {
    const before = structuredClone(value);
    assert.throws(() => schema.normalizeWorkspace(value), { code: "UNSUPPORTED_WORKSPACE_SCHEMA" });
    assert.deepEqual(value, before);
  }
});

test("workspace validation accepts format 3 and protects future workflows including legacy aliases", () => {
  assert.equal(schema.SESSION_WORKFLOW_SCHEMA_VERSION, require("../session-workflow.js").SCHEMA_VERSION);
  for (const field of ["sessionWorkflow", "sessionDeskState", "reconciliationState"]) {
    const value = { campaigns: [{ id: "campaign", [field]: { schemaVersion: 3, futurePlan: "preserve" } }] };
    assert.deepEqual(schema.normalizeWorkspace(value).state, value);
    value.campaigns[0][field].schemaVersion = 4;
    const before = structuredClone(value);
    assert.throws(() => schema.normalizeWorkspace(value), { code: "UNSUPPORTED_WORKSPACE_SCHEMA" });
    assert.deepEqual(value, before);
  }
});

test("workflow recovery checkpoints follow campaign identity and only actual format upgrades", () => {
  const older = { campaigns: [{ id: "old", sessionWorkflow: { schemaVersion: 2 } }] };
  const newer = { campaigns: [{ id: "old", sessionWorkflow: { schemaVersion: 3 } }] };
  assert.equal(schema.needsWorkflowBackup(older, newer), true);
  assert.equal(schema.needsWorkflowBackup(newer, newer), false);
  assert.equal(schema.needsWorkflowBackup(undefined, newer), false);
  assert.equal(schema.needsWorkflowBackup(older, { campaigns: [{ id: "different", sessionWorkflow: { schemaVersion: 3 } }] }), false);
  assert.equal(schema.needsWorkflowBackup({ campaigns: [{ id: "old", sessionDeskState: { sessions: [] } }] }, newer), true);
});
