const { createRequire } = require("node:module");
const { pathToFileURL } = require("node:url");
const path = require("node:path");

function installResponseCompatibility() {
  const proxyPackage = require.resolve("mcp-remote/package.json");
  const http = createRequire(proxyPackage)("undici");
  // The SDK checks instanceof Response, while mcp-remote uses Undici's fetch.
  // Match those types within this dedicated child process.
  Object.assign(globalThis, { fetch: http.fetch, Response: http.Response, Request: http.Request, Headers: http.Headers });
  return path.join(path.dirname(proxyPackage), "dist", "proxy.js");
}

if (require.main === module) {
  const entry = installResponseCompatibility();
  process.argv = [process.execPath, entry, "https://mcp.myarchivist.ai/mcp", "--auth-timeout", "90"];
  import(pathToFileURL(entry).href).catch(() => {
    console.error("The bundled Archivist proxy could not start.");
    process.exitCode = 1;
  });
}
module.exports = { installResponseCompatibility };
