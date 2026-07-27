const test = require("node:test");
const assert = require("node:assert/strict");
const { looksLikePf2e, normalizeFoundryActor } = require("../foundry-actor-normalizer.js");

function pf2eActor(overrides = {}) {
  return {
    _id: "pf2e-actor-1",
    name: "Kyra",
    type: "character",
    system: {
      details: { level: { value: 7 } },
      attributes: {
        hp: { value: 83, max: 83 },
        ac: { value: 25 },
        speed: { value: "25 feet" }
      },
      perception: { mod: 16 },
      saves: {
        fortitude: { value: 18 },
        reflex: { value: 14 },
        will: { value: 17 }
      },
      abilities: {
        str: { mod: 4 },
        dex: { mod: 0 },
        wis: { mod: 5 }
      },
      traits: { value: ["human", "humanoid"] }
    },
    items: [
      { name: "Raise a Shield", type: "action", system: { description: { value: "<p>Gain a bonus to AC.</p>" } } }
    ],
    ...overrides
  };
}

test("normalizes current PF2e actor statistics and metadata", () => {
  const actor = normalizeFoundryActor(pf2eActor(), { systemId: "pf2e" });

  assert.equal(actor.id, "pf2e-actor-1");
  assert.equal(actor.systemId, "pf2e");
  assert.equal(actor.isPf2e, true);
  assert.equal(actor.level, 7);
  assert.deepEqual(actor.traits, ["human", "humanoid"]);
  assert.deepEqual(actor.stats.slice(0, 8), [
    { label: "Level", value: "7" },
    { label: "HP", value: "83 / 83" },
    { label: "AC", value: "25" },
    { label: "Perception", value: "+16" },
    { label: "Speed", value: "25 feet" },
    { label: "Fortitude", value: "+18" },
    { label: "Reflex", value: "+14" },
    { label: "Will", value: "+17" }
  ]);
  assert.ok(actor.abilities.some(ability => ability.label === "DEX" && ability.value === "+0"));
  assert.equal(actor.items[0].description, "Gain a bonus to AC.");
});

test("recognizes a PF2e NPC export when system metadata is absent", () => {
  const raw = pf2eActor({ type: "npc", systemId: undefined, _stats: undefined });
  assert.equal(looksLikePf2e(raw, raw.system, ""), true);
  assert.equal(normalizeFoundryActor(raw).systemId, "pf2e");
});

test("keeps generic Foundry actors system-neutral", () => {
  const actor = normalizeFoundryActor({
    id: "generic-1",
    name: "Clockwork Guard",
    type: "npc",
    system: {
      attributes: { hp: { value: 20, max: 30 }, ac: { value: 15 }, speed: { value: 30 } },
      abilities: { str: { mod: 0 } }
    }
  }, { systemId: "custom-system" });

  assert.equal(actor.isPf2e, false);
  assert.equal(actor.systemId, "custom-system");
  assert.ok(actor.stats.some(stat => stat.label === "Defense" && stat.value === "15"));
  assert.ok(actor.abilities.some(ability => ability.value === "+0"));
});
