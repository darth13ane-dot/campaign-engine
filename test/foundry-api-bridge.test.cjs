const test = require("node:test");
const assert = require("node:assert/strict");
const {
  FoundryApiClient,
  bridgeUrl,
  numericRange,
  syncActors,
  tableCreateParams
} = require("../foundry-api-bridge.js");

class FakeSocket {
  static instances = [];
  constructor(url) {
    this.url = url;
    this.readyState = 0;
    this.sent = [];
    FakeSocket.instances.push(this);
    queueMicrotask(() => { this.readyState = 1; this.onopen?.(); });
  }
  send(value) { this.sent.push(JSON.parse(value)); }
  close() { this.readyState = 3; this.onclose?.(); }
  respond(id, data, success = true) { this.onmessage?.({ data: JSON.stringify({ id, success, data, error: success ? undefined : data }) }); }
}

test.beforeEach(() => { FakeSocket.instances = []; });

test("bridgeUrl adds the API key without losing existing query values", () => {
  const value = new URL(bridgeUrl("wss://api.example.test/v1/connect?world=one", "pk_secret"));
  assert.equal(value.protocol, "wss:");
  assert.equal(value.searchParams.get("world"), "one");
  assert.equal(value.searchParams.get("apiKey"), "pk_secret");
  assert.throws(() => bridgeUrl("https://example.test", "pk_secret"), /ws:\/\/ or wss:\/\//);
});

test("client correlates responses and surfaces Foundry errors", async () => {
  const client = new FoundryApiClient({ url: "wss://api.example.test/connect", apiKey: "pk_test", WebSocketImpl: FakeSocket, timeout: 1000 });
  await client.connect();
  const socket = FakeSocket.instances[0];
  const worldPromise = client.request("get-world-info", {});
  socket.respond(socket.sent[0].id, { world: { title: "Test World" } });
  assert.equal((await worldPromise).world.title, "Test World");
  const actorPromise = client.request("get-actor", { actorId: "missing" });
  socket.respond(socket.sent[1].id, "Actor not found", false);
  await assert.rejects(actorPromise, /Actor not found/);
  client.close();
});

test("syncActors resolves actor summaries into complete actor documents", async () => {
  class SyncSocket extends FakeSocket {
    send(value) {
      super.send(value);
      const command = this.sent.at(-1);
      if (command.type === "get-world-info") queueMicrotask(() => this.respond(command.id, { world: { title: "Bridge World" } }));
      if (command.type === "get-actors") queueMicrotask(() => this.respond(command.id, [{ id: "a1", name: "Vale", type: "character" }]));
      if (command.type === "get-actor") queueMicrotask(() => this.respond(command.id, { id: "a1", name: "Vale", type: "character", system: { attributes: { hp: { value: 12 } } }, items: [] }));
    }
  }
  const result = await syncActors({ url: "wss://api.example.test/connect", apiKey: "pk_test", WebSocketImpl: SyncSocket, timeout: 1000 });
  assert.equal(result.world.world.title, "Bridge World");
  assert.equal(result.actors[0].system.attributes.hp.value, 12);
  assert.deepEqual(result.warnings, []);
});

test("roll-table payload preserves authored ranges", () => {
  assert.deepEqual(numericRange("03–05", 0), [3, 5]);
  const params = tableCreateParams({ name: "Rumors", formula: "1d6", results: [{ text: "Quiet", range: [1, 2] }, { text: "Loud", range: "3-6" }] });
  assert.deepEqual(params.results.map(item => item.range), [[1, 2], [3, 6]]);
});
