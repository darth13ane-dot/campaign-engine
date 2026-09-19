const test = require("node:test");
const assert = require("node:assert/strict");
const preview = require("../player-preview.js");
const packets = require("../player-packet.js");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function campaign(overrides = {}) {
  return {
    id: "campaign-public", title: "The Road", system: "Custom", genre: "Adventure",
    sessions: [], characters: [], quests: [], locations: [], journal: [],
    ...overrides
  };
}
function known(record) { return { knowledge: "players", ...record }; }

test("player preview projects only public text and neutral directory fields across every record type", () => {
  const privateFields = {
    tags: ["PRIVATE_TAG"], sourceId: "PRIVATE_SOURCE", source: "PRIVATE_ORIGIN",
    localOverrides: { body: "PRIVATE_OVERRIDE" }, provenance: { label: "PRIVATE_PROVENANCE" },
    history: [{ text: "PRIVATE_HISTORY" }], notes: "PRIVATE_NOTES", statBlock: "PRIVATE_STATBLOCK",
    voice: "PRIVATE_VOICE", quirks: "PRIVATE_QUIRKS", relationships: "PRIVATE_RELATIONSHIPS",
    factions: ["PRIVATE_FACTION"], directions: ["PRIVATE_DIRECTIONS"], archetype: "PRIVATE_ARCHETYPE",
    tropes: ["PRIVATE_TROPES"], threadGaps: ["PRIVATE_GAPS"], expanded: { content: "PRIVATE_EXPANSION" }
  };
  const value = campaign({
    summary: "PRIVATE_SUMMARY", nextSession: "PRIVATE_NEXT_SESSION", players: "PRIVATE_PLAYER_LIST",
    connections: [{ type: "PRIVATE_CONNECTION" }], arcs: [{ title: "PRIVATE_ARC" }],
    documents: [{ text: "PRIVATE_DOCUMENT" }], builders: [{ text: "PRIVATE_BUILDER" }],
    checklist: [{ text: "PRIVATE_CHECK" }], history: [{ text: "PRIVATE_CAMPAIGN_HISTORY" }],
    systemData: { content: "PRIVATE_SYSTEM_DATA" }, sessionWorkflow: { playerPackets: { draft: { body: "PRIVATE_PACKET" } }, preps: { prep: { opening: "PRIVATE_PREP" } } },
    characters: [known({ ...privateFields, localId: "pc-1", name: "Mira", description: "A roadwarden.", role: "PC · PRIVATE_ROLE" })],
    sessions: [known({ ...privateFields, localId: "session-1", title: "The crossing", recap: "The party crossed.", number: "4", date: "2026-09-09", upcoming: false })],
    quests: [known({ ...privateFields, localId: "quest-1", title: "Find the courier", detail: "Search the road.", status: "PRIVATE_STATUS" })],
    locations: [known({ ...privateFields, localId: "location-1", title: "Bridge", detail: "A stone bridge." })],
    journal: [known({ ...privateFields, localId: "journal-1", title: "Notice", body: "The bridge is open.", detail: "PRIVATE_OLD_DETAIL", permission: "GM only" })]
  });
  const before = structuredClone(value), projected = preview.projectCampaign(value);
  assert.equal(projected.characters[0].description, "A roadwarden.");
  assert.equal(projected.characters[0].role, "PC");
  assert.deepEqual(projected.characters[0].factions, []);
  assert.equal(projected.sessions[0].recap, "The party crossed.");
  assert.equal(projected.sessions[0].number, 4);
  assert.equal(projected.sessions[0].date, "2026-09-09");
  assert.equal(projected.quests[0].status, "Active");
  assert.equal(projected.locations[0].detail, "A stone bridge.");
  assert.equal(projected.journal[0].body, "The bridge is open.");
  assert.equal(projected.journal[0].permission, "Player safe");
  assert.equal(projected.journal[0].localId, "journal-1", "The in-app projection retains routing identity");
  assert.doesNotMatch(JSON.stringify(projected), /PRIVATE_/);
  assert.equal(projected.sessionWorkflow, undefined);
  assert.deepEqual(value, before);
  projected.characters[0].name = "Changed only in projection";
  assert.deepEqual(value, before);
});

test("player preview denies unknown and conflicting permissions while accepting exact legacy sharing", () => {
  const value = campaign({ journal: [
    { localId: "unknown", title: "PRIVATE_UNKNOWN", body: "PRIVATE_UNKNOWN_BODY" },
    { localId: "substring", title: "PRIVATE_SUBSTRING", permission: "not public" },
    { localId: "denied", title: "PRIVATE_DENIED", knowledge: "gm", permission: "Player safe", public: true },
    { localId: "false", title: "PRIVATE_FALSE", knowledge: false, playerKnown: true },
    { localId: "legacy", title: "Notice", body: "For the town", permission: "Player safe" }
  ] });
  const projected = preview.projectCampaign(value);
  assert.deepEqual(projected.journal.map(record => record.localId), ["legacy"]);
  assert.doesNotMatch(JSON.stringify(projected), /PRIVATE_/);
});

test("player preview redacts hidden, missing, ambiguous, nested, and unfinished wiki references", () => {
  const body = "Known [[Journal: Town notice]]. Hidden [[Journal: HIDDEN_WIKI]]. Missing [[Journal: MISSING_WIKI]]. Duplicate [[Journal: DUPLICATE_WIKI]]. Nested [[Journal: [[HIDDEN_NESTED]] suffix]]. Unsupported [[Story arc: HIDDEN_ARC]]. Unfinished [[Journal: HIDDEN_UNFINISHED";
  const value = campaign({
    journal: [
      known({ localId: "notice", title: "Town notice", body: "Welcome" }),
      { localId: "hidden", title: "HIDDEN_WIKI", knowledge: "gm", body: "PRIVATE_LINKED_BODY" },
      known({ localId: "duplicate-a", title: "DUPLICATE_WIKI" }),
      { localId: "duplicate-b", title: "DUPLICATE_WIKI", knowledge: "gm" }
    ],
    sessions: [known({ localId: "session", title: "News [[Journal: HIDDEN_WIKI]]", recap: body })]
  });
  const projected = preview.projectCampaign(value);
  assert.equal(projected.sessions[0].title, "News [Unshared reference]");
  assert.match(projected.sessions[0].recap, /^Known Town notice\./);
  assert.doesNotMatch(projected.sessions[0].recap, /HIDDEN_|MISSING_WIKI|DUPLICATE_WIKI|suffix|PRIVATE_LINKED_BODY|\[\[/);
  assert.equal((projected.sessions[0].recap.match(/\[Unshared reference\]/g) || []).length, 6);
});

test("all displayed campaign labels and session dates redact hidden wiki targets", () => {
  const linked = "[[Journal: HIDDEN_LABEL]]";
  const value = campaign({
    title: `Campaign ${linked}`, system: `Custom ${linked}`, genre: `Genre ${linked}`,
    journal: [{ localId: "hidden", title: "HIDDEN_LABEL", knowledge: "gm" }],
    sessions: [known({ localId: "session", title: "Road report", recap: "Safe text", date: linked })]
  });
  const projected = preview.projectCampaign(value);
  assert.doesNotMatch(JSON.stringify(projected), /HIDDEN_LABEL|\[\[/);
  assert.equal(projected.system, "Custom [Unshared reference]");
  assert.equal(projected.sessions[0].date, "[Unshared reference]");
});

test("stable identities keep same-name records distinct and ambiguous identities are excluded", () => {
  const value = campaign({ journal: [
    { localId: "hidden", title: "Shared name", knowledge: "gm", body: "PRIVATE_HIDDEN_BODY" },
    known({ localId: "shared", title: "Shared name", body: "The public version" }),
    known({ localId: "collision", title: "Ambiguous first", body: "PRIVATE_COLLISION_A" }),
    known({ localId: "collision", title: "Ambiguous second", body: "PRIVATE_COLLISION_B" }),
    known({ title: "Legacy collision", body: "PRIVATE_LEGACY_A" }),
    known({ title: "Legacy collision", body: "PRIVATE_LEGACY_B" })
  ] });
  const projected = preview.projectCampaign(value);
  assert.deepEqual(projected.journal.map(record => record.body), ["The public version"]);
  assert.equal(projected.journal[0].localId, "shared");
  assert.doesNotMatch(JSON.stringify(projected), /PRIVATE_/);
});

test("fresh projection follows permission revocation and redacts previously shared linked labels", () => {
  const value = campaign({ journal: [known({ localId: "notice", title: "Formerly shared", body: "PRIVATE_AFTER_REVOCATION" })], sessions: [known({ localId: "session", title: "Report", recap: "Read [[Journal: Formerly shared]]." })] });
  assert.equal(preview.projectCampaign(value).sessions[0].recap, "Read Formerly shared.");
  value.journal[0].knowledge = "gm";
  value.journal[0].permission = "Player safe";
  const projected = preview.projectCampaign(value);
  assert.deepEqual(projected.journal, []);
  assert.equal(projected.sessions[0].recap, "Read [Unshared reference].");
  assert.doesNotMatch(JSON.stringify(projected), /PRIVATE_AFTER_REVOCATION|Formerly shared/);
});

test("projected content stays inert text when rendered into a standalone player document", () => {
  const value = campaign({ journal: [known({ localId: "notice", title: '<img src="https://example.invalid/title">', body: '<script>alert("x")</script><img src="https://example.invalid/body" onerror="alert(1)"> & plain text' })] });
  const record = preview.projectCampaign(value).journal[0];
  const html = packets.renderHTML({ title: record.title, sections: [{ heading: "Notice", body: record.body }] });
  assert.doesNotMatch(html, /<script|<img|onerror="/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /&amp; plain text/);
});

test("player-preview campaign chrome uses each campaign's current link visibility", () => {
  const value = campaign({ title: "Road [[Journal: HIDDEN_CHROME]]", system: "Custom [[Journal: HIDDEN_CHROME]]", genre: "Adventure [[Journal: HIDDEN_CHROME]]", journal: [{ localId: "hidden", title: "HIDDEN_CHROME", knowledge: "gm" }] });
  const other = campaign({ id: "campaign-other", title: "Other [[Journal: Public notice]]", journal: [known({ localId: "notice", title: "Public notice" })] });
  const elements = new Map();
  const element = selector => {
    if (!elements.has(selector)) elements.set(selector, { textContent: "", style: {} });
    return elements.get(selector);
  };
  const app = fs.readFileSync(path.join(__dirname, "../app.js"), "utf8");
  const start = app.indexOf("function updateCampaignChrome()"), end = app.indexOf("\nfunction header(", start);
  assert(start >= 0 && end > start);
  const menu = { innerHTML: "" };
  const context = {
    activeCampaign: () => value, state: { campaigns: [value, other] }, playerPreviewActive: () => true,
    window: { CampaignPlayerPacket: packets, CampaignPlayerPreview: preview },
    document: { documentElement: { dataset: {} }, querySelector: element },
    campaignMenu: menu, campaignSwitcher: {}, nav: { querySelectorAll: () => [] }, workspaceLoadError: null, knowledgeModeToggle: null, knowledgeModeLabel: null,
    esc: value => String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]))
  };
  vm.runInNewContext(`${app.slice(start, end)}\nupdateCampaignChrome();`, context);
  assert.doesNotMatch(element("#activeCampaignName").textContent + menu.innerHTML, /HIDDEN_CHROME|\[\[/);
  assert.match(menu.innerHTML, /Other Public notice/);
  assert.match(menu.innerHTML, /data-campaign-id="campaign-other"/);
});

function detailHarness(value, target, playerMode = true) {
  const app = fs.readFileSync(path.join(__dirname, "../app.js"), "utf8");
  const start = app.indexOf("function entityDetailView(campaign)"), end = app.indexOf("\nfunction getFoundryState(", start);
  assert(start >= 0 && end > start);
  const context = {
    detailTarget: target, playerPreviewActive: () => playerMode,
    playerCanSee: record => !playerMode || record.knowledge === "players",
    esc: value => String(value ?? ""), stripJournalLinks: value => value,
    header: title => `<header>${title}</header>`, initials: value => value.slice(0, 2),
    knowledgeLabel: () => "Players know", archivistDetail: () => null,
    renderJournalContent: (campaign, text) => text,
    knowledgeDetailSection: () => "", quickTagSection: () => "", characterTableNotes: () => "",
    connectionDetailSection: () => "", structuredSections: () => "", sessionPrepAction: () => "", playerPacketAction: () => ""
  };
  vm.runInNewContext(app.slice(start, end), context);
  return context.entityDetailView(value);
}

test("record detail selects exact stable IDs across duplicate names and renames in GM and player views", () => {
  for (const [collection, type, field] of [["characters", "character", "description"], ["quests", "quest", "detail"], ["locations", "location", "detail"], ["journal", "journal", "body"], ["sessions", "session", "recap"]]) {
    const value = campaign({ [collection]: [known({ localId: "first", name: "Same title", title: "Same title", [field]: "First record body" }), known({ localId: "second", name: "Same title", title: "Same title", [field]: "Second record body" })] });
    for (const mode of [false, true]) {
      const markup = detailHarness(value, { type, name: "Same title", id: "second" }, mode);
      assert.match(markup, /Second record body/, `${collection} ${mode}`);
      assert.doesNotMatch(markup, /First record body/);
    }
    const record = value[collection][1]; record.name = record.title = "Renamed record"; record.archivistId = "new-imported-id";
    assert.match(detailHarness(value, { type, name: "Same title", id: "second" }), /Renamed record.*Second record body/s, collection);
  }
});

test("record detail rejects deleted or ambiguous identities and permits only unique legacy names", () => {
  const value = campaign({ journal: [known({ localId: "first", title: "Same title", body: "First body" }), known({ localId: "second", title: "Same title", body: "Second body" })] });
  assert.match(detailHarness(value, { type: "journal", name: "Same title", id: "deleted" }), /That record has moved/);
  assert.match(detailHarness(value, { type: "journal", name: "Same title" }), /That record has moved/);
  value.journal[1].localId = "first";
  assert.match(detailHarness(value, { type: "journal", name: "Same title", id: "first" }), /That record has moved/);
  value.journal.pop();
  assert.match(detailHarness(value, { type: "journal", name: "Same title" }), /First body/);
  value.journal[0].knowledge = "gm";
  const denied = detailHarness(value, { type: "journal", name: "Same title", id: "first" });
  assert.match(denied, /This record is GM only/);
  assert.doesNotMatch(denied, /First body/);
});
