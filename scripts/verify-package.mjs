import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
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
const fonts = JSON.parse(fs.readFileSync(path.join(root, "vendor/fonts/assets.json"))).map(name => name.replace(/^\.\//, ""));
for (const name of new Set([...linked, ...pdf, ...fonts, "vendor/fonts/assets.json", "vendor/pdfjs/assets.json", "service-worker.js", "electron/main.cjs", "electron/desktop-security.cjs", "electron/preload.cjs", "electron/workspace-close.cjs", "electron/workspace-store.cjs", "electron/archivist-mcp-bridge.cjs", "electron/archivist-proxy.cjs"])) {
  const source = ["archivist-data.js", "archivist-details.js"].includes(name) ? path.join(root, "release-assets", name) : path.join(root, name);
  assert(asar.extractFile(archive, path.normalize(name)).equals(fs.readFileSync(source)), `${name} is absent or differs from the validated source.`);
}
const proxyPackage = JSON.parse(asar.extractFile(archive, path.normalize("node_modules/mcp-remote/package.json")));
assert.equal(proxyPackage.version, pkg.dependencies["mcp-remote"], "The bundled Archivist proxy must match the pinned version.");
const context = { window: {} }; vm.createContext(context);
for (const name of ["archivist-data.js", "archivist-details.js"]) vm.runInContext(asar.extractFile(archive, name).toString(), context);
if (process.env.CAMPAIGN_ENGINE_PRIVATE_BUILD !== "1") {
  assert.equal(context.window.ARCHIVIST_SNAPSHOT.campaigns.length, 0, "Public releases must exclude private campaigns.");
  assert.equal(Object.keys(context.window.ARCHIVIST_DETAILS.campaigns).length, 0, "Public releases must exclude private campaign details.");
}
assert.match(pkg.devDependencies.electron, /^\d+\.\d+\.\d+$/, "Pin the exact stable Electron version reviewed for this release.");
assert.equal(process.platform, "win32", "Verify the packaged Windows runtime on Windows.");
// Run only the runtime's Node entry point: never open the application or its
// normal user profile while inspecting the built executable.
const runtime = spawnSync(path.join(path.dirname(path.dirname(archive)), `${pkg.productName}.exe`), ["-e", "process.stdout.write(JSON.stringify(process.versions))"], {
  env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", NODE_OPTIONS: "" },
  encoding: "utf8", windowsHide: true, timeout: 15000
});
assert.equal(runtime.status, 0, `Unable to inspect the packaged runtime: ${runtime.error?.message || runtime.stderr}`);
const versions = JSON.parse(runtime.stdout.trim());
assert.equal(versions.electron, pkg.devDependencies.electron, "The packaged Electron runtime must match the reviewed dependency.");
console.log(`Verified packaged v${pkg.version}: Electron ${versions.electron}, Chromium ${versions.chrome}, Node ${versions.node}; all HTML/PDF/font runtime assets match source; ${process.env.CAMPAIGN_ENGINE_PRIVATE_BUILD === "1" ? "explicit private build" : "private snapshots excluded"}.`);
