const test = require("node:test");
const assert = require("node:assert/strict");
const { matchesCharacterFilter, matchesSheetFilter, roleGroup, sheetSearchText } = require("../character-filters.js");

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

test("sheet filters combine role, link state, PF2e level, and search", () => {
  const pc = { name: "Kyra", role: "PC · Cleric", description: "A shield-bearing healer." };
  const npc = { name: "Goblin Pyro", role: "NPC · Hostile" };
  const actor = {
    name: "Kyra",
    level: 7,
    traits: ["human", "cleric"],
    stats: [{ label: "AC", value: "25" }],
    items: [{ name: "Raise a Shield" }]
  };

  assert.equal(matchesSheetFilter(pc, actor, { filter: "PC", level: "7", query: "shield" }), true);
  assert.equal(matchesSheetFilter(pc, actor, { filter: "NPC" }), false);
  assert.equal(matchesSheetFilter(pc, actor, { filter: "Linked" }), true);
  assert.equal(matchesSheetFilter(npc, null, { filter: "Unlinked" }), true);
  assert.equal(matchesSheetFilter(pc, actor, { level: "5" }), false);
  assert.match(sheetSearchText(pc, actor), /raise a shield/);
});
