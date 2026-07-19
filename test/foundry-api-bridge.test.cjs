const test = require("node:test");
const assert = require("node:assert/strict");
const {
  DEFAULT_URL,
  FoundryApiClient,
  apiBaseUrl,
  numericRange,
  sendBuilderContent,
  syncActors,
  tableCreateParams
} = require("../foundry-api-bridge.js");

function jsonResponse(payload, status = 200) {
  return { ok: status >= 200 && status < 300, status, async json() { return payload; } };
}

test("apiBaseUrl migrates the connection-disrupting WebSocket URL to the public REST API", () => {
  assert.equal(apiBaseUrl("wss://api.foundry-mcp.com/v1/connect"), DEFAULT_URL);
  assert.equal(apiBaseUrl("https://api.example.test/v1/"), "https://api.example.test/v1");
  assert.throws(() => apiBaseUrl("ftp://api.example.test"), /http:\/\/ or https:\/\//);
});

test("client uses bearer-authenticated HTTPS requests and surfaces API errors", async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith("/world")) return jsonResponse({ data: { title: "Test World" } });
    return jsonResponse({ error: "Actor not found" }, 404);
  };
  const client = new FoundryApiClient({ url: "https://api.example.test/v1", apiKey: "pk_test", fetchImpl });
  assert.equal((await client.request("/world")).title, "Test World");
  assert.equal(calls[0].options.headers.Authorization, "Bearer pk_test");
  await assert.rejects(client.request("/actors/missing"), /Actor not found/);
});

test("syncActors follows pagination and resolves actor refs into complete records", async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    if (url.endsWith("/world")) return jsonResponse({ data: { id: "world", title: "Bridge World", system: "pf2e" } });
    if (url.includes("/actors?limit=200&offset=0")) return jsonResponse({ data: [{ id: "a1", name: "Vale" }], pagination: { limit: 200, offset: 0, total: 2, has_more: true } });
    if (url.includes("/actors?limit=200&offset=1")) return jsonResponse({ data: [{ id: "a2", name: "Mara" }], pagination: { limit: 200, offset: 1, total: 2, has_more: false } });
    if (url.endsWith("/actors/a1")) return jsonResponse({ data: { id: "a1", name: "Vale", type: "character", image: "vale.png", system: { attributes: { hp: { value: 12 } } }, items: [] } });
    if (url.endsWith("/actors/a2")) return jsonResponse({ data: { id: "a2", name: "Mara", type: "npc", image: "", system: {}, items: [] } });
    return jsonResponse({ error: "Unexpected test URL" }, 500);
  };
  const result = await syncActors({ url: "https://api.example.test/v1", apiKey: "pk_test", fetchImpl });
  assert.equal(result.world.title, "Bridge World");
  assert.deepEqual(result.actors.map(actor => actor.name), ["Vale", "Mara"]);
  assert.equal(result.actors[0].system.attributes.hp.value, 12);
  assert.equal(calls.filter(url => url.includes("/actors?")).length, 2);
  assert.deepEqual(result.warnings, []);
});

test("builder sends use the documented actor and roll-table REST endpoints", async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options, body: JSON.parse(options.body) });
    return jsonResponse({ data: { id: String(calls.length) } }, 201);
  };
  const result = await sendBuilderContent(
    { url: "https://api.example.test/v1", apiKey: "pk_test", fetchImpl },
    { actors: [{ name: "Scout", type: "npc", img: "scout.png", system: {} }], tables: [{ name: "Rumors", results: [{ text: "Quiet", range: [1, 2] }] }] }
  );
  assert.deepEqual(calls.map(call => call.url), ["https://api.example.test/v1/actors", "https://api.example.test/v1/roll-tables"]);
  assert.equal(calls[0].body.image, "scout.png");
  assert.equal(calls[1].body.display_roll, true);
  assert.equal(result.actors.length, 1);
  assert.equal(result.tables.length, 1);
});

test("roll-table payload preserves authored ranges", () => {
  assert.deepEqual(numericRange("03–05", 0), [3, 5]);
  const params = tableCreateParams({ name: "Rumors", formula: "1d6", results: [{ text: "Quiet", range: [1, 2] }, { text: "Loud", range: "3-6" }] });
  assert.deepEqual(params.results.map(item => item.range), [[1, 2], [3, 6]]);
});
