const test = require("node:test");
const assert = require("node:assert/strict");
const { matchesCharacterFilter, roleGroup } = require("../character-filters.js");

test("PC and NPC roles are classified without substring overlap", () => {
  assert.equal(roleGroup("PC · Wizard"), "PC");
  assert.equal(roleGroup("NPC · Antagonist"), "NPC");
  assert.equal(roleGroup("Foundry actor"), "NPC");
});

test("character filters return mutually exclusive PC and NPC results", () => {
  const pc = { role: "PC · Wizard" };
  const npc = { role: "NPC · Antagonist" };
  assert.equal(matchesCharacterFilter(pc, "PC"), true);
  assert.equal(matchesCharacterFilter(npc, "PC"), false);
  assert.equal(matchesCharacterFilter(pc, "NPC"), false);
  assert.equal(matchesCharacterFilter(npc, "NPC"), true);
  assert.equal(matchesCharacterFilter(npc, "All"), true);
});
