const test = require("node:test");
const assert = require("node:assert/strict");
const search = require("../campaign-search.js");
const knowledge = require("../campaign-knowledge.js");
const campaign = {
  sessions: [{ title: "River crossing", recap: "A silver key", knowledge: "players" }],
  arcs: [{ title: "Silver crown", tension: "A hidden regent" }],
  characters: [{ name: "Secret keeper", description: "Silver key", knowledge: "gm" }],
  sessionWorkflow: { desks: { desk: { id: "desk", sessionRef: { name: "Crossing" }, scratch: "Silver door", log: [] } } },
  documents: [{ id: "rules", title: "Travel", contextEnabled: true, pageTexts: [{ page: 1, text: "Introduction" }, { page: 92, text: "Silver keys open the river locks." }] }]
};
test("searches sessions, arcs, scratchpads, and PDF pages with filters", () => {
  const index = search.buildIndex(campaign);
  assert.equal(search.search(index, "silver").total, 5);
  const result = search.search(index, "silver", { type: "reference" }).results[0];
  assert.equal(result.page, 92); assert.equal(result.documentId, "rules");
});
test("player search excludes private records, live notes, arcs, and reference text", () => {
  const index = search.buildIndex(campaign, { playerPreview: true, visible: (record, collection) => knowledge.isVisible(record, "players", collection) });
  assert.deepEqual(search.search(index, "silver").results.map(item => item.type), ["session"]);
});
test("retrieves matching later passages and never supplies excluded books", () => {
  const copy = structuredClone(campaign);
  copy.documents[0].pageTexts[1].text = "Unrelated text. ".repeat(1000) + "Silver keys open the river locks.";
  copy.documents.push({ id: "private", title: "Excluded", contextEnabled: false, text: "Silver keys silver keys" });
  const passages = search.referencePassages(copy, "silver keys");
  assert(passages.some(p => p.page === 92 && p.text.includes("Silver keys")));
  assert(passages.every(p => p.documentId === "rules"));
  assert.equal(search.referencePassages(copy, "nonexistentphrase").length, 0);
});
test("supports legacy reference text without inventing page numbers", () => {
  const passages = search.referencePassages({ documents: [{ id: "legacy", title: "Old import", text: "A silver key", contextEnabled: true }] }, "silver");
  assert.equal(passages[0].page, null);
});
