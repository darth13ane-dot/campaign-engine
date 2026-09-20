// Synthetic campaign data only. Run: node scripts/benchmark-workspace.cjs > results.json
const os = require("node:os");
const fs = require("node:fs/promises");
const path = require("node:path");
const { performance } = require("node:perf_hooks");
const history = require("../campaign-history.js");
const search = require("../campaign-search.js");
const preview = require("../player-preview.js");
const knowledge = require("../campaign-knowledge.js");
const { createWorkspaceStore } = require("../electron/workspace-store.cjs");

const cases = [
  { name: "ongoing", campaigns: 1, records: 250, sessions: 24, pages: 100 },
  { name: "long-running", campaigns: 1, records: 4000, sessions: 200, pages: 600 },
  { name: "four-campaigns", campaigns: 4, records: 4000, sessions: 200, pages: 600 }
];
function fixture(options) {
  const prose = "The river watch asks the party to inspect the old ferry. A merchant offers a silver key in exchange for safe passage. ";
  const campaigns = Array.from({ length: options.campaigns }, (_, ci) => {
    const campaign = { id: `campaign-${ci}`, title: `Synthetic campaign ${ci + 1}`, system: ["Custom", "WFRP 4th Edition", "Pathfinder 2e", "D&D 5e"][ci % 4], summary: "Synthetic performance fixture", characters: [], quests: [], locations: [], journal: [], sessions: [], arcs: [], connections: [], builders: [], checklist: [], documents: [], sessionWorkflow: { schemaVersion: 2, preps: {}, desks: {}, playerPackets: {}, reconciliations: {} } };
    const collections = ["characters", "quests", "locations", "journal"];
    const fields = ["description", "detail", "detail", "body"];
    for (let i = 0; i < options.records; i++) {
      const kind = i % 4, label = `River ${collections[kind]} ${i}`;
      campaign[collections[kind]].push({ localId: `record-${ci}-${i}`, [kind ? "title" : "name"]: label, [fields[kind]]: `${prose.repeat(8)} Account ${i}.`, knowledge: i % 3 ? "players" : "gm", tags: ["river", `district-${i % 20}`], ...(kind === 0 ? { role: "NPC", voice: "Private voice note" } : kind === 1 ? { status: "Active" } : {}) });
    }
    for (let i = 0; i < options.sessions; i++) {
      const session = { localId: `session-${ci}-${i}`, title: `River journey ${i + 1}`, number: i + 1, recap: prose.repeat(4), knowledge: "players", upcoming: i === options.sessions - 1 };
      campaign.sessions.push(session);
      const id = `prep-${ci}-${i}`, sessionRef = { localId: session.localId, name: session.title, number: session.number };
      campaign.sessionWorkflow.preps[id] = { id, sessionRef, opening: prose, durationMinutes: 180, scenes: Array.from({ length: 4 }, (_, si) => ({ id: `${id}-scene-${si}`, title: `River scene ${si + 1}`, kind: "scene", minutes: 30, detail: prose.repeat(2), question: "Who gains the key?" })), pinned: [], revelations: [], clocks: [], spotlights: [], tasks: [] };
    }
    campaign.documents = [{ id: `book-${ci}`, title: "Synthetic river gazetteer", contextEnabled: false, pageTexts: Array.from({ length: options.pages }, (_, i) => ({ page: i + 1, text: `Page ${i + 1}. ${prose.repeat(18)}` })) }];
    return campaign;
  });
  return { schemaVersion: 1, state: { activeCampaignId: campaigns[0].id, campaigns, knowledgeMode: "gm" }, archivist: { campaigns: {} } };
}
async function measure(action, count = 7) {
  await action(); await action();
  const samples = [];
  for (let i = 0; i < count; i++) { const start = performance.now(); await action(); samples.push(performance.now() - start); }
  samples.sort((a, b) => a - b);
  const round = value => Math.round(value * 100) / 100;
  return { median: round(samples[Math.floor(samples.length / 2)]), min: round(samples[0]), max: round(samples.at(-1)), samples: count };
}
async function benchmark() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "campaign-engine-benchmark-"));
  const result = { version: require("../package.json").version, node: process.version, platform: `${process.platform} ${process.arch}`, cpu: os.cpus()[0]?.model, memoryGiB: Math.round(os.totalmem() / 2 ** 30), units: "milliseconds; warm median of 7 measured runs after 2 warmups", cases: [] };
  try {
    for (const options of cases) {
      const workspace = fixture(options), campaign = workspace.state.campaigns[0], tracker = history.createTracker();
      tracker.reset(workspace.state.campaigns);
      const index = search.buildIndex(campaign);
      const store = createWorkspaceStore({ directory: path.join(directory, options.name), appVersion: result.version });
      await store.initializeWorkspace(workspace);
      const row = { ...options, jsonBytes: Buffer.byteLength(JSON.stringify(workspace)), searchEntries: index.length, timings: {} };
      row.timings.historyUnchanged = await measure(() => tracker.capture(workspace.state.campaigns));
      let edit = 0;
      row.timings.historyOneRecord = await measure(() => { campaign.characters[0].description = `Edit ${edit++}`; tracker.capture(workspace.state.campaigns); });
      row.timings.cloneState = await measure(() => structuredClone(workspace.state));
      row.timings.serializeWorkspace = await measure(() => JSON.stringify(workspace));
      row.timings.searchIndex = await measure(() => search.buildIndex(campaign));
      row.timings.searchCommon = await measure(() => search.search(index, "river"));
      row.timings.searchRare = await measure(() => search.search(index, "district-19"));
      row.timings.playerProjection = await measure(() => preview.projectCampaign(campaign));
      row.timings.normalizeKnowledge = await measure(() => knowledge.normalizeCampaign(campaign));
      row.timings.desktopSave = await measure(() => store.saveState(workspace.state));
      row.timings.desktopLoad = await measure(() => store.loadWorkspace());
      result.cases.push(row);
    }
    return result;
  } finally {
    const resolved = path.resolve(directory), prefix = path.resolve(os.tmpdir()) + path.sep;
    if (!resolved.startsWith(prefix) || !path.basename(resolved).startsWith("campaign-engine-benchmark-")) throw new Error("Unexpected benchmark cleanup path");
    await fs.rm(resolved, { recursive: true, force: true });
  }
}
module.exports = { cases, fixture, measure, benchmark };
if (require.main === module) benchmark().then(result => console.log(JSON.stringify(result, null, 2))).catch(error => { console.error(error); process.exitCode = 1; });
