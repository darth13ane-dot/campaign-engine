const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const {
  callArchivistTool,
  normalizeBridgeSettings,
  parseArgs,
  syncArchivistBridge,
  testArchivistBridge,
  toolResultPayload
} = require("../electron/archivist-mcp-bridge.cjs");

async function fakeMcpServer(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "campaign-engine-mcp-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const serverPath = path.join(directory, "fake-mcp.cjs");
  await fs.writeFile(serverPath, `
process.stdin.setEncoding("utf8");
let buffer = "";
function send(message) {
  process.stdout.write(JSON.stringify(message) + "\\n");
}
process.stdin.on("data", chunk => {
  buffer += chunk;
  let index;
  while ((index = buffer.indexOf("\\n")) >= 0) {
    const line = buffer.slice(0, index).trim();
    buffer = buffer.slice(index + 1);
    if (!line) continue;
    const message = JSON.parse(line);
    if (!message.id) continue;
    if (message.method === "initialize") send({ jsonrpc: "2.0", id: message.id, result: { protocolVersion: "2024-11-05", serverInfo: { name: "Fake Archivist" } } });
    if (message.method === "tools/list") send({ jsonrpc: "2.0", id: message.id, result: { tools: [{ name: "campaign_engine_export", description: "Export Campaign Engine workspace" }] } });
    if (message.method === "tools/call") send({ jsonrpc: "2.0", id: message.id, result: { content: [{ type: "text", text: JSON.stringify({ campaigns: [{ id: "archivist-1", title: "Archivist One" }], details: { "archivist-1": { sessions: {} } } }) }] } });
  }
});
`, "utf8");
  return serverPath;
}

async function fakeNativeArchivistServer(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "campaign-engine-native-mcp-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const serverPath = path.join(directory, "fake-native-mcp.cjs");
  await fs.writeFile(serverPath, `
process.stdin.setEncoding("utf8");
let buffer = "";
const toolNames = [
  "list-campaigns-tool", "get-campaign-tool", "list-characters-tool",
  "list-sessions-tool", "list-factions-tool", "list-locations-tool",
  "list-items-tool", "list-quests-tool", "list-journals-tool",
  "get-journal-tool", "list-links-tool"
];
function send(message) {
  process.stdout.write(JSON.stringify(message) + "\\n");
}
function page(data, currentPage = 1, lastPage = 1) {
  return { current_page: currentPage, data, last_page: lastPage, total: lastPage === 2 ? 2 : data.length };
}
function toolPayload(name, args) {
  if (name === "list-campaigns-tool") return page([{ id: "campaign-1", title: "The Long Road", system: "Pathfinder 2e" }]);
  if (name === "get-campaign-tool") return { id: args.campaign_id, title: "The Long Road", system: "Pathfinder 2e", summary: "A complete campaign summary." };
  if (name === "list-characters-tool") {
    return Number(args.page || 1) === 1
      ? page([{ id: "character-1", character_name: "Vale", type: "PC", description: "First character." }], 1, 2)
      : page([{ id: "character-2", character_name: "Mira", type: "NPC", description: "Second character." }], 2, 2);
  }
  if (name === "list-sessions-tool") return page([{ id: "session-1", title: "Arrival", summary: "The road begins.", session_date: "2026-06-01T00:00:00Z" }]);
  if (name === "list-factions-tool") return page([{ id: "faction-1", name: "The Watch", description: "City defenders." }]);
  if (name === "list-locations-tool") return page([{ id: "location-1", name: "North Gate", description: "The city entrance." }]);
  if (name === "list-items-tool") return page([{ id: "item-1", name: "Old Key", description: "It opens something." }]);
  if (name === "list-quests-tool") return page([{ id: "quest-1", quest_name: "Find the Road", status: "in-progress", next_action: "Ask Vale." }]);
  if (name === "list-journals-tool") return page([{ id: "journal-1", title: "Road Notes" }]);
  if (name === "get-journal-tool") return { id: args.journal_id, title: "Road Notes", content: "The full journal text.", public: false };
  if (name === "list-links-tool") return page([{ id: "link-1", from_id: "character-1", to_id: "quest-1", alias: "Vale follows the road" }]);
  return page([]);
}
process.stdin.on("data", chunk => {
  buffer += chunk;
  let index;
  while ((index = buffer.indexOf("\\n")) >= 0) {
    const line = buffer.slice(0, index).trim();
    buffer = buffer.slice(index + 1);
    if (!line) continue;
    const message = JSON.parse(line);
    if (!message.id) continue;
    if (message.method === "initialize") {
      send({ jsonrpc: "2.0", id: message.id, result: { protocolVersion: "2024-11-05", serverInfo: { name: "Fake Archivist" } } });
    }
    if (message.method === "tools/list") {
      send({ jsonrpc: "2.0", id: message.id, result: { tools: toolNames.map(name => ({ name })) } });
    }
    if (message.method === "tools/call") {
      const payload = toolPayload(message.params.name, message.params.arguments || {});
      send({ jsonrpc: "2.0", id: message.id, result: {
        content: [{ type: "text", text: JSON.stringify(payload) }],
        structuredContent: payload,
        isError: false
      } });
    }
  }
});
`, "utf8");
  return serverPath;
}

test("normalizes command arguments without shell execution", () => {
  assert.deepEqual(parseArgs('"server path.cjs" --flag value'), ["server path.cjs", "--flag", "value"]);
  assert.deepEqual(normalizeBridgeSettings({ command: "node", args: '["server.cjs"]' }).args, ["server.cjs"]);
});

test("lists tools and calls an Archivist MCP import tool", async t => {
  const serverPath = await fakeMcpServer(t);
  const settings = {
    command: process.execPath,
    args: [serverPath],
    toolName: "campaign_engine_export",
    toolArguments: "{}",
    timeoutMs: 5000
  };

  const health = await testArchivistBridge(settings);
  assert.equal(health.ok, true);
  assert.equal(health.serverInfo.name, "Fake Archivist");
  assert.equal(health.tools[0].name, "campaign_engine_export");

  const result = await callArchivistTool(settings);
  const payload = toolResultPayload(result);
  assert.equal(payload.campaigns[0].title, "Archivist One");
  assert.equal(payload.details["archivist-1"].sessions.constructor, Object);
});

test("assembles native Archivist tools into a paginated Campaign Engine payload", async t => {
  const serverPath = await fakeNativeArchivistServer(t);
  const result = await syncArchivistBridge({
    command: process.execPath,
    args: [serverPath],
    toolName: "get-beat-tool",
    toolArguments: '{"includeLinks":true}',
    timeoutMs: 5000
  });

  assert.equal(result.mode, "archivist-native");
  assert.equal(result.campaignCount, 1);
  const campaign = result.payload.state.campaigns[0];
  assert.equal(campaign.title, "The Long Road");
  assert.deepEqual(campaign.characters.map(item => item.name), ["Vale", "Mira"]);
  assert.equal(campaign.sessions[0].archivistId, "session-1");
  assert.equal(campaign.quests[0].status, "Active");
  assert.equal(campaign.journal[0].body, "The full journal text.");
  assert.equal(campaign.connections[0].from.name, "Vale");
  assert.equal(campaign.connections[0].to.name, "Find the Road");
  assert.equal(result.payload.archivist.campaigns["campaign-1"].characters.Vale.id, "character-1");
});
