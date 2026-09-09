const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createReview,
  applyReview,
  annotateCampaign,
  findDetail,
  mergeCampaigns,
  mergeDetailsRoots
} = require("../archivist-merge.js");
const knowledge = require("../campaign-knowledge.js");

test("Archivist visibility accepts exact legacy sharing labels and rejects misleading substrings", () => {
  const permissions = [
    ["not public", "gm"], ["read forbidden", "gm"], ["player secrets", "gm"],
    ["unread", "gm"], ["", "gm"], [undefined, "gm"], ["GM only", "gm"],
    ["Player safe", "players"], ["players", "players"], ["player", "players"],
    ["player known", "players"], ["public", "players"], ["shared", "players"],
    ["read", "players"], ["  PUBLIC  ", "players"], [true, "players"]
  ];
  for (const [permission, expected] of permissions) {
    const input = campaign({ journal: [{ title: "The notice", permission }] });
    const before = structuredClone(input);
    const annotated = annotateCampaign(input, {}, true).journal[0];
    const added = mergeCampaigns([], [input]).campaigns[0].journal[0];
    for (const record of [annotated, added]) {
      assert.equal(record.knowledge, expected, `permission ${String(permission)}`);
      assert.equal(record.permission, expected === "players" ? "Player safe" : "GM only");
    }
    assert.deepEqual(input, before);
  }
});

test("Archivist normalization honors explicit knowledge before legacy visibility flags", () => {
  const cases = [
    { knowledge: false, public: true, permission: "Player safe" },
    { knowledge: "", playerKnown: true, permission: "Player safe" },
    { knowledge: "not public", permission: "Player safe" },
    { knowledge: "gm", playerKnown: true, public: true },
    { playerKnown: false, public: true, permission: "Player safe" },
    { public: false, permission: "Player safe" },
    { playerKnown: true }, { public: true }, { knowledge: true },
    { knowledge: " PUBLIC ", permission: "GM only" }
  ];
  for (const fields of cases) {
    for (const collection of ["sessions", "characters", "quests", "locations", "journal"]) {
      const input = { title: "Notice", name: "Courier", ...fields };
      const actual = annotateCampaign(campaign({ [collection]: [input] }), {}, true)[collection][0];
      assert.equal(actual.knowledge, knowledge.recordKnowledge(input, collection), `${collection}: ${JSON.stringify(fields)}`);
      if (collection === "journal") assert.equal(actual.permission, knowledge.permissionFor(actual.knowledge));
    }
  }
});

test("refresh review keeps local knowledge authoritative and synchronizes journal permissions", () => {
  for (const local of ["gm", "players"]) {
    const remote = local === "gm" ? "players" : "gm";
    const original = campaign({ journal: [{ archivistId: "notice", title: "The notice", body: "Local words", knowledge: local, localOverrides: { knowledge: local } }] });
    const incoming = campaign({ journal: [{ archivistId: "notice", title: "Renamed notice", body: "Fresh words", knowledge: remote }] });
    const before = structuredClone(original);
    const merged = mergeCampaigns([original], [incoming]).campaigns[0].journal[0];
    assert.equal(merged.knowledge, local);
    assert.equal(merged.permission, knowledge.permissionFor(local));
    assert.equal(merged.localOverrides.knowledge, local);
    const review = createReview([original], [incoming], {}, {});
    const row = review.rows.find(item => item.field === "knowledge");
    assert.equal(row.conflict, true);
    assert.equal(row.choice, "local");
    const kept = applyReview(review, [original]).campaigns[0].journal[0];
    assert.equal(kept.knowledge, local);
    assert.equal(kept.permission, knowledge.permissionFor(local));
    assert.equal(kept.body, "Fresh words");
    assert.equal(kept.localOverrides.knowledge, local);
    const accepted = applyReview(review, [original], { [row.id]: "incoming" }).campaigns[0].journal[0];
    assert.equal(accepted.knowledge, remote);
    assert.equal(accepted.permission, knowledge.permissionFor(remote));
    assert.equal(accepted.localOverrides.knowledge, undefined);
    assert.deepEqual(original, before);
  }
});

test("approved refresh keeps misleading imported permissions private", () => {
  for (const permission of ["not public", "read forbidden"]) {
    const original = campaign({ journal: [{ archivistId: "notice", title: "The notice", knowledge: "gm" }] });
    const incoming = campaign({ journal: [{ archivistId: "notice", title: "The notice", body: "Updated secret", permission }] });
    const review = createReview([original], [incoming], {}, {});
    const record = applyReview(review, [original]).campaigns[0].journal[0];
    assert.equal(record.body, "Updated secret");
    assert.equal(record.knowledge, "gm");
    assert.equal(record.permission, "GM only");
  }
});

test("approved Archivist refresh preserves nested pending and approved player packets", () => {
  const workflow = {
    schemaVersion: 2,
    desks: { ended: { id: "ended", status: "ended" } },
    playerPackets: {
      pending: { id: "pending", status: "draft", sourceRefs: [{ type: "session", localId: "session-1" }], customText: "GM draft awaiting review" },
      approved: { id: "approved", status: "approved", preview: { title: "Road report", text: "The party returned." }, approval: { fingerprint: "approved-output" } }
    }
  };
  const original = campaign({ sessionWorkflow: structuredClone(workflow), journal: [{ archivistId: "notice", title: "Notice", body: "Old" }] });
  const incoming = campaign({ sessionWorkflow: { schemaVersion: 2, playerPackets: {} }, journal: [{ archivistId: "notice", title: "Notice", body: "Fresh" }] });
  const before = structuredClone(original);
  const review = createReview([original], [incoming], {}, {});
  const applied = applyReview(review, [original]).campaigns[0];
  assert.equal(applied.journal[0].body, "Fresh");
  assert.deepEqual(applied.sessionWorkflow, workflow);
  assert.deepEqual(original, before);
  applied.sessionWorkflow.playerPackets.pending.customText = "Changed independently";
  assert.deepEqual(original, before);
  assert.deepEqual(review.campaigns[0].sessionWorkflow, workflow);
});

test("preserves Foundry actor links across an Archivist rename", () => {
  const original = campaign({ characters: [{ archivistId: "npc", name: "Vale", foundryActorId: "actor-7" }] });
  const incoming = campaign({ characters: [{ archivistId: "npc", name: "Captain Vale" }] });
  assert.equal(mergeCampaigns([original], [incoming]).campaigns[0].characters[0].foundryActorId, "actor-7");
});
test("custom exports match existing local ids and cannot erase local workflow or history", () => {
  const original = campaign({ characters: [{ localId: "local-one", source: "manual", name: "Local keeper" }], arcs: [{ id: "arc", title: "Local arc" }], history: [{ id: "history" }], sessionWorkflow: { schemaVersion: 1, desks: { desk: {} } } });
  const incoming = campaign({ characters: [{ localId: "local-one", source: "manual", name: "Local keeper" }], arcs: [], history: [], sessionWorkflow: {} });
  const merged = mergeCampaigns([original], [incoming]).campaigns[0];
  assert.equal(merged.characters.length, 1); assert.equal(merged.arcs.length, 1); assert.equal(merged.history.length, 1); assert(merged.sessionWorkflow.desks.desk);
});
test("previews conflicts without mutating data and applies field choices", () => {
  const original = campaign({ characters: [{ archivistId: "npc", name: "Vale", description: "Local", localOverrides: { description: "Local" }, foundryActorId: "actor-7" }] });
  const incoming = campaign({ characters: [{ archivistId: "npc", name: "Captain Vale", description: "Remote" }] });
  const review = createReview([original], [incoming], {}, {});
  const description = review.rows.find(row => row.field === "description");
  assert.equal(description.choice, "local"); assert.equal(original.characters[0].name, "Vale");
  const kept = applyReview(review, [original]); assert.equal(kept.campaigns[0].characters[0].description, "Local");
  const changed = applyReview(review, [original], { [description.id]: "incoming" }).campaigns[0].characters[0];
  assert.equal(changed.description, "Remote"); assert.equal(changed.localOverrides.description, undefined); assert.equal(changed.foundryActorId, "actor-7");
  original.characters[0].description = "Edited during preview"; assert.throws(() => applyReview(review, [original]), /workspace changed/);
});

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
        tags: ["local"],
        factions: ["The Watch"],
        voice: "Measured and quiet",
        quirks: "Counts exits",
        relationships: "Protective of Mira",
        statBlock: "Creature 5\nPerception +12"
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
  assert.deepEqual(result.campaigns[0].characters[0].factions, ["The Watch"]);
  assert.equal(result.campaigns[0].characters[0].voice, "Measured and quiet");
  assert.equal(result.campaigns[0].characters[0].quirks, "Counts exits");
  assert.equal(result.campaigns[0].characters[0].relationships, "Protective of Mira");
  assert.equal(result.campaigns[0].characters[0].statBlock, "Creature 5\nPerception +12");
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
