import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const source = path.dirname(require.resolve("pdfjs-dist/package.json"));
const destination = path.resolve(import.meta.dirname, "../vendor/pdfjs");
await fs.mkdir(destination, { recursive: true });
// Electron 37 needs the supported compatibility build (including Uint8Array.toHex).
for (const name of ["pdf.mjs", "pdf.worker.mjs"]) await fs.copyFile(path.join(source, "legacy", "build", name), path.join(destination, name));
await fs.copyFile(path.join(source, "LICENSE"), path.join(destination, "LICENSE"));
// Text extraction can need character maps for embedded CJK fonts.
for (const name of ["cmaps", "standard_fonts", "wasm"]) await fs.cp(path.join(source, name), path.join(destination, name), { recursive: true });
const files = await fs.readdir(destination, { recursive: true, withFileTypes: true });
const assets = files.filter(file => file.isFile() && file.name !== "assets.json").map(file => "./vendor/pdfjs/" + path.relative(destination, path.join(file.parentPath, file.name)).replaceAll("\\", "/"));
await fs.writeFile(path.join(destination, "assets.json"), JSON.stringify(assets));
console.log("Local PDF.js assets prepared.");
