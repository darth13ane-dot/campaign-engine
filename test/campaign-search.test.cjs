const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const search = require("../campaign-search.js");
const knowledge = require("../campaign-knowledge.js");
const prep = require("../session-prep.js");
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

function preparedCampaign() {
  return {
    id: "campaign-prep",
    sessions: [{ id: "session-one", title: "Same title", knowledge: "players" }, { id: "session-two", title: "Same title", knowledge: "players" }],
    sessionWorkflow: { preps: {
      "prep-one": { id: "prep-one", sessionRef: { id: "session-one", name: "Same title" }, opening: "firstopening" },
      "prep-two": {
        id: "prep-two", sessionRef: { id: "session-two", name: "privatereference" }, opening: "secretopening",
        scenes: [{ title: "secretscene", detail: "secretdetail", question: "secretquestion" }],
        revelations: [{ text: "secretrevelation" }],
        spotlights: [{ character: "secretcharacter", opportunity: "secretopportunity" }],
        tasks: [{ text: "secrettask" }], pinned: [{ type: "journal", name: "secretpin" }], clocks: [{ label: "secretclock" }]
      }
    } }
  };
}

test("indexes every saved prep text field for the GM and excludes every field from player search", () => {
  const value = preparedCampaign();
  const before = structuredClone(value);
  const gmIndex = search.buildIndex(value);
  const playerIndex = search.buildIndex(value, { playerPreview: true, visible: () => true });
  const words = ["privatereference", "secretopening", "secretscene", "secretdetail", "secretquestion", "secretrevelation", "secretcharacter", "secretopportunity", "secrettask", "secretpin", "secretclock"];
  assert.equal(search.labels.prep, "Session prep");
  assert.equal(playerIndex.some(entry => entry.type === "prep"), false);
  for (const word of words) {
    const found = search.search(gmIndex, word, { type: "prep" });
    assert.equal(found.total, 1, word);
    assert.equal(found.results[0].prepId, "prep-two", word);
    assert.equal(search.search(playerIndex, word).total, 0, word);
  }
  assert.deepEqual(value, before, "Building search indexes must not modify saved prep");
});

test("duplicate prep titles retain their own identifiers and an unprepared session stays unprepared", () => {
  const value = preparedCampaign();
  value.sessionWorkflow.preps["prep-two"].sessionRef.name = "Same title";
  const found = search.search(search.buildIndex(value), "same title", { type: "prep" });
  assert.deepEqual(found.results.map(entry => entry.prepId), ["prep-one", "prep-two"]);
  const unprepared = { sessions: [{ id: "session", title: "Unprepared session" }] };
  const before = structuredClone(unprepared);
  assert.equal(search.buildIndex(unprepared).some(entry => entry.type === "prep"), false);
  assert.deepEqual(unprepared, before);
});

function searchViewHarness(campaign) {
  const elements = new Map();
  let preview = false;
  const opened = [], messages = [];
  function element(selector) {
    if (!elements.has(selector)) elements.set(selector, { value: selector === "#searchFilter" ? "all" : "", innerHTML: "", handlers: {}, addEventListener(type, callback) { this.handlers[type] = callback; }, focus() {} });
    return elements.get(selector);
  }
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../workspace-views.js"), "utf8"), {
    window: { CampaignSearch: search, CampaignSessionPrep: prep },
    document: { querySelector: element }, root: { addEventListener() {} },
    activeCampaign: () => campaign, playerPreviewActive: () => preview,
    playerCanSee: (record, collection) => knowledge.isVisible(record, "players", collection),
    esc: value => String(value), searchModal: { close() {}, showModal() {} },
    openSessionPrep: (campaign, session) => opened.push({ campaign, session }),
    showToast: message => messages.push(message)
  });
  return {
    opened, messages, element,
    setPreview(value) { preview = value; },
    query(value) { element("#searchInput").value = value; element("#searchButton").handlers.click(); },
    click(index = 0) { element("#searchResults").handlers.click({ target: { closest: selector => selector === "[data-search-hit]" ? { dataset: { searchHit: String(index) } } : null } }); }
  };
}

test("prep search opens the identified session after a rename despite duplicate titles", () => {
  const value = preparedCampaign();
  value.sessionWorkflow.preps["prep-two"].sessionRef.name = "Same title";
  const view = searchViewHarness(value);
  view.query("secretopening");
  value.sessions[1].title = "Renamed session";
  view.click();
  assert.equal(view.opened.length, 1);
  assert.equal(view.opened[0].campaign, value);
  assert.equal(view.opened[0].session, value.sessions[1]);
});

test("stale prep search gives safe feedback when its session or saved prep was removed", () => {
  for (const removed of ["session", "prep"]) {
    const value = preparedCampaign();
    const view = searchViewHarness(value);
    view.query("secretopening");
    if (removed === "session") value.sessions.splice(1, 1);
    else delete value.sessionWorkflow.preps["prep-two"];
    view.click();
    assert.equal(view.opened.length, 0, removed);
    assert.match(view.messages[0], /no longer available/, removed);
  }
});

test("player mode removes the prep filter and rejects stale GM search results", () => {
  const view = searchViewHarness(preparedCampaign());
  view.query("secretopening");
  assert.match(view.element("#searchFilter").innerHTML, /value="prep"/);
  view.setPreview(true);
  view.click();
  assert.equal(view.opened.length, 0);
  assert.match(view.messages[0], /GM view/);
  view.element("#searchInput").handlers.input();
  assert.doesNotMatch(view.element("#searchResults").innerHTML, /secretopening/);
  view.query("secretopening");
  assert.doesNotMatch(view.element("#searchFilter").innerHTML, /value="prep"/);
  assert.match(view.element("#searchResults").innerHTML, /0 results/);
});
