const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const {
  callArchivistTool,
  normalizeBridgeSettings,
  parseArgs,
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
