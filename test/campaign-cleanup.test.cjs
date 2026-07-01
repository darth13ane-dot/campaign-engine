const assert = require("node:assert/strict");
const test = require("node:test");

const {
  applySelected,
  buildInventory,
  sanitizeSuggestions
} = require("../campaign-cleanup.js");

function campaign() {
  return {
    characters: [{ name: "Vale" }, { name: "Mira" }],
    quests: [{ title: "Find the Road" }],
    locations: [],
    journal: [],
    sessions: [],
    connections: [
      {
        id: "connection-1",
        from: { type: "character", name: "Vale" },
        to: { type: "quest", name: "Find the Road" },
        type: "Protects",
        note: "Vale guards the route."
      },
      {
        id: "connection-2",
        from: { type: "character", name: "Vale" },
        to: { type: "quest", name: "Find the Road" },
        type: "Knows about",
        note: "Vale knows where it begins."
      },
      {
        id: "connection-3",
        from: { type: "character", name: "Mira" },
        to: { type: "quest", name: "Find the Road" },
        type: "Seeks",
        note: "A distinct relationship."
      }
    ],
    arcs: [
      {
        id: "arc-1",
        title: "The Lost Road",
        status: "Active",
        tension: "Vale must choose a route.",
        nextStep: "Ask Vale.",
        related: [{ type: "character", name: "Vale" }]
      },
      {
        id: "arc-2",
        title: "Road Lost",
        status: "Planned",
        tension: "The route remains hidden.",
        nextStep: "Find a map.",
        related: [{ type: "quest", name: "Find the Road" }]
      },
      {
        id: "arc-3",
        title: "Mira's Choice",
        status: "Planned",
        tension: "Mira must decide.",
        nextStep: "Speak with Mira.",
        related: [{ type: "character", name: "Mira" }]
      }
    ]
  };
}

test("builds stable cleanup references for current connections and arcs", () => {
  const inventory = buildInventory(campaign());
  assert.deepEqual(inventory.connections.map(row => row.ref), ["C1", "C2", "C3"]);
  assert.deepEqual(inventory.arcs.map(row => row.ref), ["A1", "A2", "A3"]);
});

test("sanitizes merge and removal proposals against the current campaign", () => {
  const value = campaign();
  const suggestions = sanitizeSuggestions(value, {
    connections: [{
      action: "merge",
      keepRef: "C1",
      removeRefs: ["C2", "C99"],
      mergedType: "Protects",
      mergedNote: "Vale knows and protects the route.",
      reason: "These describe the same underlying relationship.",
      evidence: "Both connect Vale to Find the Road."
    }],
    arcs: [{
      action: "merge",
      keepRef: "A1",
      removeRefs: ["A2"],
      merged: {
        title: "The Lost Road",
        status: "Active",
        tension: "The route is hidden and Vale must choose how to reveal it.",
        nextStep: "Ask Vale about the map.",
        related: [
          { type: "character", name: "Vale" },
          { type: "quest", name: "Find the Road" }
        ]
      },
      reason: "Both arcs track the same unresolved route.",
      evidence: "They share the road, Vale, and the map decision."
    }]
  });

  assert.deepEqual(suggestions.connections[0].removeRefs, ["C2"]);
  assert.equal(suggestions.connections[0].mergedNote, "Vale knows and protects the route.");
  assert.deepEqual(suggestions.arcs[0].removeRefs, ["A2"]);
  assert.deepEqual(suggestions.arcs[0].merged.related, [
    { type: "character", name: "Vale" },
    { type: "quest", name: "Find the Road" }
  ]);
});

test("applies only explicitly selected cleanup actions", () => {
  const value = campaign();
  const suggestions = sanitizeSuggestions(value, {
    connections: [{
      action: "merge",
      keepRef: "C1",
      removeRefs: ["C2"],
      mergedType: "Protects",
      mergedNote: "Vale knows and protects the route.",
      reason: "Duplicate relationship.",
      evidence: "Same endpoints."
    }],
    arcs: [{
      action: "remove",
      keepRef: "",
      removeRefs: ["A2"],
      merged: {},
      reason: "This arc repeats the active road arc.",
      evidence: "Same road conflict and next decision."
    }]
  });

  const skipped = applySelected(value, suggestions, { connections: [], arcs: [] });
  assert.equal(skipped.actionsApplied, 0);
  assert.equal(value.connections.length, 3);
  assert.equal(value.arcs.length, 3);

  const applied = applySelected(value, suggestions, { connections: [0], arcs: [0] });
  assert.equal(applied.actionsApplied, 2);
  assert.equal(applied.connectionsMerged, 1);
  assert.equal(applied.connectionsRemoved, 1);
  assert.equal(applied.arcsRemoved, 1);
  assert.deepEqual(value.connections.map(item => item.id), ["connection-1", "connection-3"]);
  assert.equal(value.connections[0].note, "Vale knows and protects the route.");
  assert.deepEqual(value.arcs.map(item => item.id), ["arc-1", "arc-3"]);
});
