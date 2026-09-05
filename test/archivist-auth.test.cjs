const assert = require("node:assert/strict");
const test = require("node:test");
const http = require("node:http");
const { createRequire } = require("node:module");
const { bridgeError, bridgeProcess } = require("../electron/archivist-mcp-bridge.cjs");
const { installResponseCompatibility } = require("../electron/archivist-proxy.cjs");

test("bundled proxy recognizes a real Undici OAuth error response", async t => {
  const original = { fetch: globalThis.fetch, Response: globalThis.Response, Request: globalThis.Request, Headers: globalThis.Headers };
  t.after(() => Object.assign(globalThis, original));
  const server = http.createServer((_, response) => {
    response.writeHead(400, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ error: "invalid_grant" }));
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  installResponseCompatibility();
  const proxyHttp = createRequire(require.resolve("mcp-remote/package.json"))("undici");
  const response = await proxyHttp.fetch(`http://127.0.0.1:${server.address().port}`);
  assert(response instanceof Response, "The SDK must recognize the proxy response before parsing its body.");
  assert.equal(response.status, 400);
  assert.deepEqual(JSON.parse(await response.text()), { error: "invalid_grant" });
});

test("built-in launch uses the packaged runtime and a private auth directory", () => {
  const launch = bridgeProcess({ command: "archivist", args: [] }, { authDirectory: "private-auth" });
  assert.equal(launch.command, process.execPath);
  assert.equal(launch.env.ELECTRON_RUN_AS_NODE, "1");
  assert.equal(launch.env.MCP_REMOTE_CONFIG_DIR, "private-auth");
  assert.match(launch.args[0], /archivist-proxy\.cjs$/);
  assert.deepEqual(bridgeProcess({ command: "custom-node", args: ["server with spaces.cjs"] }).args, ["server with spaces.cjs"]);
});

test("OAuth failures remain actionable without leaking callback parameters", () => {
  assert.match(bridgeError("[123] Fatal error: InvalidGrantError"), /invalid_grant/);
  assert.match(bridgeError("Invalid OAuth error response: [object Response]"), /built-in connection/);
  const message = bridgeError("[123] Fatal error: refused https://example.com/oauth?code=private&state=private Bearer secret-token");
  assert(!message.includes("private"));
  assert(!message.includes("secret-token"));
});
