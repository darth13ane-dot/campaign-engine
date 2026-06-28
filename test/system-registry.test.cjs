const assert = require("node:assert/strict");
const test = require("node:test");
const { normalizeCampaign } = require("../systems/campaign-system-state.js");

function freshRegistry() {
  const path = require.resolve("../systems/registry.js");
  delete require.cache[path];
  return require(path);
}

test("registers systems and resolves stable ids or display names", () => {
  const registry = freshRegistry();
  registry.register({ id: "pf2e", name: "Pathfinder 2e" });
  registry.register({ id: "custom", name: "Custom" });

  assert.equal(registry.get("pf2e").name, "Pathfinder 2e");
  assert.equal(registry.idFor("Pathfinder 2e"), "pf2e");
  assert.equal(registry.get("unknown").id, "custom");
});

test("returns system views only for enabled campaign systems", () => {
  const registry = freshRegistry();
  registry.register({
    id: "pf2e",
    name: "Pathfinder 2e",
    view: { id: "system-pf2e", label: "PF2e tools" }
  });
  registry.register({ id: "wfrp4e", name: "WFRP 4th Edition" });

  const wfrpViews = registry.viewsFor({
    systems: [{ id: "wfrp4e", name: "WFRP 4th Edition", enabled: true }]
  });
  const pf2eViews = registry.viewsFor({
    systems: [{ id: "pf2e", name: "Pathfinder 2e", enabled: true }]
  });

  assert.deepEqual(wfrpViews, []);
  assert.equal(pf2eViews[0].id, "system-pf2e");
});

test("removes empty legacy PF2e state from a WFRP campaign", () => {
  const registry = freshRegistry();
  registry.register({ id: "pf2e", name: "Pathfinder 2e" });
  registry.register({ id: "wfrp4e", name: "WFRP 4th Edition" });
  registry.register({ id: "custom", name: "Custom" });
  const campaign = {
    system: "WFRP 4th Edition",
    pf2e: { encounters: [], treasurePlans: [], statBlocks: [], creations: [] }
  };

  normalizeCampaign(campaign, registry);

  assert.equal("pf2e" in campaign, false);
  assert.equal("pf2e" in campaign.systemData, false);
  assert.deepEqual(campaign.systems, [{ id: "wfrp4e", name: "WFRP 4th Edition", enabled: true }]);
});

test("preserves populated legacy PF2e records in the namespaced system bucket", () => {
  const registry = freshRegistry();
  registry.register({ id: "pf2e", name: "Pathfinder 2e" });
  registry.register({ id: "custom", name: "Custom" });
  const campaign = {
    system: "Pathfinder 2e",
    pf2e: { encounters: [{ id: "encounter-1" }], treasurePlans: [] }
  };

  normalizeCampaign(campaign, registry);

  assert.equal("pf2e" in campaign, false);
  assert.equal(campaign.systemData.pf2e.encounters[0].id, "encounter-1");
});

test("normalizes legacy generated system ids by their valid system name", () => {
  const registry = freshRegistry();
  registry.register({ id: "pf2e", name: "Pathfinder 2e" });
  registry.register({ id: "custom", name: "Custom" });
  const campaign = {
    system: "Pathfinder 2e",
    systems: [{ id: "system-pathfinder-2e", name: "Pathfinder 2e", enabled: true }]
  };

  normalizeCampaign(campaign, registry);

  assert.deepEqual(campaign.systems, [{ id: "pf2e", name: "Pathfinder 2e", enabled: true }]);
});
