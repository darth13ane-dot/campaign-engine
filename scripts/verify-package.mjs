import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const builderRequire = createRequire(require.resolve("electron-builder"));
const appRequire = createRequire(builderRequire.resolve("app-builder-lib"));
const asar = appRequire("@electron/asar");
const root = path.resolve(import.meta.dirname, "..");
const archive = path.resolve(process.argv[2] || path.join(root, "dist/win-unpacked/resources/app.asar"));
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json")));
const packedPackage = JSON.parse(asar.extractFile(archive, "package.json"));
assert.equal(packedPackage.version, pkg.version, "The built version must match the release.");
const html = asar.extractFile(archive, "index.html").toString();
const linked = [...html.matchAll(/(?:src|href)="([^"?#]+)(?:\?[^"#]*)?"/g)].map(match => match[1]).filter(name => !name.startsWith("http"));
const pdf = JSON.parse(fs.readFileSync(path.join(root, "vendor/pdfjs/assets.json"))).map(name => name.replace(/^\.\//, ""));
for (const name of new Set([...linked, ...pdf, "service-worker.js", "electron/preload.cjs", "electron/workspace-close.cjs"])) {
  const source = ["archivist-data.js", "archivist-details.js"].includes(name) ? path.join(root, "release-assets", name) : path.join(root, name);
  assert(asar.extractFile(archive, path.normalize(name)).equals(fs.readFileSync(source)), `${name} is absent or differs from the validated source.`);
}
const context = { window: {} }; vm.createContext(context);
for (const name of ["archivist-data.js", "archivist-details.js"]) vm.runInContext(asar.extractFile(archive, name).toString(), context);
if (process.env.CAMPAIGN_ENGINE_PRIVATE_BUILD !== "1") {
  assert.equal(context.window.ARCHIVIST_SNAPSHOT.campaigns.length, 0, "Public releases must exclude private campaigns.");
  assert.equal(Object.keys(context.window.ARCHIVIST_DETAILS.campaigns).length, 0, "Public releases must exclude private campaign details.");
}
console.log(`Verified packaged v${pkg.version}: all HTML/PDF runtime assets match source; ${process.env.CAMPAIGN_ENGINE_PRIVATE_BUILD === "1" ? "explicit private build" : "private snapshots excluded"}.`);
