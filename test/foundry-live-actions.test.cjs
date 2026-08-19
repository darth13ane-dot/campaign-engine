const test = require("node:test");
const assert = require("node:assert/strict");
const live = require("../foundry-live-actions.js");

function clientHarness(responses = []) {
  const calls = [];
  class FoundryApiClient {
    async request(path, options = {}) {
      calls.push({ path, options });
      const response = responses[calls.length - 1];
      if (response instanceof Error) throw response;
      return response ?? {};
    }
  }
  return { calls, options: { FoundryApiClient } };
}

test("uses the documented PF2e strike, skill, save, and perception endpoints", async () => {
  const harness = clientHarness([{ strikes: [{ slug: "fist" }] }, { total: 24 }, { total: 18 }, { total: 21 }, { total: 17 }]);
  assert.equal((await live.listStrikes(harness.options, "actor 1"))[0].slug, "fist");
  await live.rollStrike(harness.options, { actorId: "actor 1", slug: "fist", mapIncrease: 2 });
  await live.rollSkill(harness.options, { actorId: "actor 1", skill: "Athletics" });
  await live.rollSave(harness.options, { actorId: "actor 1", save: "Will" });
  await live.rollPerception(harness.options, { actorId: "actor 1" });
  assert.deepEqual(harness.calls.map(call => call.path), [
    "/pf2e/strikes/list",
    "/pf2e/strikes/roll",
    "/pf2e/roll-skill",
    "/pf2e/roll-save",
    "/pf2e/roll-perception"
  ]);
  assert.deepEqual(harness.calls[1].options.body, { actor_id: "actor 1", slug: "fist", map_increase: 2, show_in_chat: true });
  assert.equal(harness.calls[2].options.body.skill, "athletics");
  assert.equal(harness.calls[3].options.body.save, "will");
});

test("conditions use explicit supported actions and clamp set values", async () => {
  const harness = clientHarness([{ conditions: [{ slug: "frightened", value: 1 }] }, {}]);
  assert.equal((await live.getConditions(harness.options, "a1"))[0].slug, "frightened");
  await live.changeCondition(harness.options, { actorId: "a1", action: "set", slug: "Frightened", value: 120 });
  assert.equal(harness.calls[1].path, "/pf2e/conditions/set");
  assert.deepEqual(harness.calls[1].options.body, { actor_id: "a1", slug: "frightened", value: 99 });
  await assert.rejects(live.changeCondition(harness.options, { actorId: "a1", action: "delete", slug: "frightened" }), /Unsupported/);
});

test("roll tables post a single chat-visible draw", async () => {
  const harness = clientHarness([[{ id: "t 1", name: "Rumors" }], { result: { text: "The bells ring" } }]);
  assert.equal((await live.listRollTables(harness.options))[0].name, "Rumors");
  const result = await live.rollTable(harness.options, { tableId: "t 1" });
  assert.equal(harness.calls[1].path, "/roll-tables/t%201/roll");
  assert.deepEqual(harness.calls[1].options.body, { display_chat: true });
  assert.equal(live.resultText(result), "The bells ring");
});

test("publishes a journal and only broadcasts after creation returns an id", async () => {
  const harness = clientHarness([{ id: "journal 1", name: "Handout" }, { shown: true }]);
  const result = await live.publishJournal(harness.options, { name: "Handout", content: "Player-safe text", showToPlayers: true });
  assert.equal(result.journal.id, "journal 1");
  assert.deepEqual(harness.calls.map(call => call.path), ["/journals", "/journals/journal%201/show"]);
  assert.equal(harness.calls[0].options.body.page_type, "text");
  assert.deepEqual(harness.calls[1].options.body, { force: true });
});

test("reports a partial journal write without retrying a failed broadcast", async () => {
  const failure = new Error("World went offline");
  const harness = clientHarness([{ id: "j1" }, failure]);
  await assert.rejects(
    live.publishJournal(harness.options, { name: "Handout", content: "Text", showToPlayers: true }),
    error => error === failure && error.partial?.journal?.id === "j1"
  );
  assert.equal(harness.calls.length, 2);
});

test("records every bridge outcome and mirrors it into an active session log", () => {
  const foundry = { live: { history: [] } };
  const desk = { status: "active", log: [] };
  const entry = live.appendActionLog(foundry, desk, { id: "action-1", at: "2026-08-19T18:00:00.000Z", label: "Vale · Athletics check", status: "succeeded", detail: "total 27" });
  assert.equal(foundry.live.history[0], entry);
  assert.deepEqual(desk.log, [{ id: "action-1", at: "2026-08-19T18:00:00.000Z", text: "Foundry succeeded: Vale · Athletics check · total 27" }]);

  const ended = { status: "ended", log: [] };
  live.appendActionLog(foundry, ended, { id: "action-2", label: "Condition", status: "failed", detail: "World offline" });
  assert.equal(ended.log.length, 0);
  assert.equal(foundry.live.history[0].id, "action-2");
});
