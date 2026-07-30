const test = require("node:test");
const assert = require("node:assert/strict");
const knowledge = require("../campaign-knowledge.js");

test("normalizes legacy journal permissions without exposing other records", () => {
  const campaign = {
    sessions: [{ title: "Secret prep" }],
    characters: [{ name: "Hidden patron" }],
    quests: [],
    locations: [],
    journal: [
      { title: "Handout", permission: "Player safe" },
      { title: "Reveal", permission: "GM only" }
    ]
  };

  knowledge.normalizeCampaign(campaign);

  assert.equal(campaign.sessions[0].knowledge, "gm");
  assert.equal(campaign.characters[0].knowledge, "gm");
  assert.equal(campaign.journal[0].knowledge, "players");
  assert.equal(campaign.journal[1].knowledge, "gm");
});

test("keeps journal permission and record knowledge in sync", () => {
  const journal = { title: "The public oath", permission: "GM only" };

  knowledge.setRecordKnowledge(journal, "players", "journal");
  assert.equal(journal.knowledge, "players");
  assert.equal(journal.permission, "Player safe");

  knowledge.setRecordKnowledge(journal, "private", "journal");
  assert.equal(journal.knowledge, "gm");
  assert.equal(journal.permission, "GM only");
});

test("player preview only includes explicitly shared records", () => {
  assert.equal(knowledge.isVisible({ knowledge: "players" }, "players"), true);
  assert.equal(knowledge.isVisible({ knowledge: "gm" }, "players"), false);
  assert.equal(knowledge.isVisible({ knowledge: "gm" }, "gm"), true);
});

test("parses conversational assistant envelopes and preserves plain text fallback", () => {
  const parsed = knowledge.parseAssistantEnvelope('```json\n{"message":"Two drafts are ready.","actions":[{"action":"create","type":"journal"}]}\n```');
  assert.equal(parsed.message, "Two drafts are ready.");
  assert.equal(parsed.actions.length, 1);

  assert.deepEqual(knowledge.parseAssistantEnvelope("A normal planning answer."), {
    message: "A normal planning answer.",
    actions: []
  });
});
