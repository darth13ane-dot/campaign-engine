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
