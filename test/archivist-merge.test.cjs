const test = require("node:test");
const assert = require("node:assert/strict");

const {
  findDetail,
  mergeCampaigns,
  mergeDetailsRoots
} = require("../archivist-merge.js");

function campaign(overrides = {}) {
  return {
    id: "campaign-1",
    title: "The Long Road",
    source: "archivist",
    sessions: [],
    characters: [],
    quests: [],
    locations: [],
    journal: [],
    connections: [],
    arcs: [],
    ...overrides
  };
}

function details(characters = {}) {
  return {
    importedAt: "2026-06-30T00:00:00.000Z",
    campaigns: {
      "campaign-1": {
        sessions: {},
        characters,
        quests: {},
        world: { location: {}, faction: {}, item: {} },
        journals: {}
      }
    }
  };
}

test("merges matching Archivist IDs and preserves local field overrides", () => {
  const existing = campaign({
    characters: [{
      archivistId: "character-1",
      name: "Captain Vale",
      role: "NPC · Ally",
      description: "My local version",
      tags: ["local"],
      lastEditedBy: "manual-edit",
      localOverrides: {
        name: "Captain Vale",
        role: "NPC · Ally",
        description: "My local version",
        tags: ["local"]
      }
    }]
  });
  const incoming = campaign({
    characters: [
      { archivistId: "character-1", name: "Vale", role: "NPC · Contact", description: "Fresh Archivist text", tags: ["archivist"] },
      { archivistId: "character-1", name: "Vale", role: "NPC · Contact", description: "Newest duplicate", tags: ["archivist"] }
    ]
  });

  const result = mergeCampaigns([existing], [incoming], details(), details());
  assert.equal(result.campaigns[0].characters.length, 1);
  assert.equal(result.campaigns[0].characters[0].name, "Captain Vale");
  assert.equal(result.campaigns[0].characters[0].description, "My local version");
  assert.deepEqual(result.campaigns[0].characters[0].tags, ["local"]);
  assert.equal(result.stats.editsPreserved, 1);
  assert.equal(result.stats.duplicatesCollapsed, 1);
});

test("adds new records while retaining manual and missing local records", () => {
  const existing = campaign({
    characters: [
      { name: "Local Hero", description: "Only in Campaign Engine", tags: [], source: "manual", localId: "local-1" },
      { archivistId: "old-archivist-record", name: "Archived NPC", description: "No longer returned", tags: [], source: "archivist" }
    ]
  });
  const incoming = campaign({
    characters: [{ archivistId: "new-character", name: "New Arrival", description: "From Archivist", tags: [] }]
  });

  const result = mergeCampaigns([existing], [incoming], details(), details());
  assert.deepEqual(result.campaigns[0].characters.map(item => item.name), ["New Arrival", "Local Hero", "Archived NPC"]);
  assert.equal(result.stats.added, 1);
  assert.equal(result.stats.localRecordsRetained, 2);
});

test("upgrades older name-only snapshots with Archivist IDs", () => {
  const existingDetails = details({ Vale: { id: "character-1", description: "Old details" } });
  const incomingDetails = details({ Vale: { id: "character-1", description: "New details" } });
  const existing = campaign({ characters: [{ name: "Vale", description: "Old summary", tags: [] }] });
  const incoming = campaign({ characters: [{ name: "Vale", description: "New summary", tags: [] }] });

  const result = mergeCampaigns([existing], [incoming], existingDetails, incomingDetails);
  assert.equal(result.campaigns[0].characters.length, 1);
  assert.equal(result.campaigns[0].characters[0].archivistId, "character-1");
  assert.equal(result.campaigns[0].characters[0].description, "New summary");
});

test("keeps a manually created same-name record distinct from an Archivist record", () => {
  const existing = campaign({
    characters: [{ name: "Vale", description: "Manual alternate", tags: [], source: "manual", localId: "local-vale" }]
  });
  const incoming = campaign({
    characters: [{ archivistId: "character-1", name: "Vale", description: "Archivist Vale", tags: [] }]
  });

  const result = mergeCampaigns([existing], [incoming], details(), details());
  assert.equal(result.campaigns[0].characters.length, 2);
  assert.deepEqual(result.campaigns[0].characters.map(item => item.description), ["Archivist Vale", "Manual alternate"]);
});

test("refreshes detail maps by ID without duplicating renamed entries", () => {
  const existing = details({ "Captain Vale": { id: "character-1", description: "Old details" } });
  const incoming = details({ Vale: { id: "character-1", description: "Fresh details" } });
  const merged = mergeDetailsRoots(existing, incoming);
  const characterMap = merged.campaigns["campaign-1"].characters;

  assert.deepEqual(Object.keys(characterMap), ["Vale"]);
  assert.equal(findDetail(merged.campaigns["campaign-1"], "characters", {
    archivistId: "character-1",
    name: "Captain Vale"
  }).description, "Fresh details");
});

test("refreshes Archivist links without removing local connections", () => {
  const existing = campaign({
    connections: [{
      id: "local-link",
      from: { type: "character", name: "Vale" },
      to: { type: "quest", name: "Find the Road" },
      type: "Protects",
      source: "manual"
    }]
  });
  const incoming = campaign({
    connections: [{
      id: "archivist-link-1",
      archivistId: "link-1",
      from: { type: "character", name: "Vale" },
      to: { type: "quest", name: "Find the Road" },
      type: "Is tied to",
      source: "archivist"
    }]
  });

  const result = mergeCampaigns([existing], [incoming], details(), details());
  assert.deepEqual(result.campaigns[0].connections.map(item => item.id), ["archivist-link-1", "local-link"]);
});
