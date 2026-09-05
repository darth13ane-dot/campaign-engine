const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const config = require("../package.json");
const assets = [...fs.readFileSync(path.join(root, "index.html"), "utf8").matchAll(/(?:src|href)="([^"?#]+)(?:\?[^"#]*)?"/g)].map(match => match[1]).filter(name => !name.startsWith("http") && !name.startsWith("#"));
test("every local HTML asset is covered by the desktop packaging manifest", () => {
  for (const asset of assets) {
    const included = config.build.files.some(rule => typeof rule === "string" ? rule === asset || (rule.endsWith("/**/*") && asset.startsWith(rule.slice(0, -4))) : rule.filter?.includes(asset));
    assert(included, `${asset} is missing from desktop build.files`);
  }
});
test("service-worker asset versions match the HTML shell", () => {
  const source = fs.readFileSync(path.join(root, "service-worker.js"), "utf8");
  const cached = [...source.matchAll(/"\.\/([^"\n]+)"/g)].map(match => match[1]);
  const linked = [...fs.readFileSync(path.join(root, "index.html"), "utf8").matchAll(/(?:src|href)="([^"#]+)"/g)].map(match => match[1]).filter(name => !name.startsWith("http"));
  for (const asset of linked) assert(cached.includes(asset), `${asset} is missing or stale in the service-worker cache`);
});
test("public release snapshot stubs contain no private campaigns", { skip: process.env.CAMPAIGN_ENGINE_PRIVATE_BUILD === "1" }, () => {
  const context = { window: {} }; vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, "release-assets/archivist-data.js"), "utf8"), context);
  vm.runInContext(fs.readFileSync(path.join(root, "release-assets/archivist-details.js"), "utf8"), context);
  assert.equal(context.window.ARCHIVIST_SNAPSHOT.campaigns.length, 0);
  assert.equal(Object.keys(context.window.ARCHIVIST_DETAILS.campaigns).length, 0);
});
